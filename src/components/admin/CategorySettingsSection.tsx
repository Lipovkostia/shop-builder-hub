import { useState, useEffect, useCallback, useRef } from "react";
import { Tag, GripVertical, Pencil, Trash2, Plus, FolderOpen, ChevronDown, ChevronRight, Save, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { StoreCategory } from "@/hooks/useStoreCategories";
import { Catalog } from "@/hooks/useStoreCatalogs";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface CategorySettingItem {
  id: string;
  name: string;
  customName: string | null;
  parentCategoryId: string | null;
  sortOrder: number;
  isSection: boolean; // true = parent/section header created via catalog_category_settings
}

interface CategorySettingsSectionProps {
  storeId: string | null;
  catalogs: Catalog[];
  categories: StoreCategory[];
  onCreateCategory: (name: string) => Promise<StoreCategory | null>;
  onRenameCategory: (id: string, newName: string) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
}

// Sortable item component
function SortableCategoryItem({
  item,
  isChild,
  editingId,
  editingName,
  onStartEdit,
  onEditNameChange,
  onSaveEdit,
  onCancelEdit,
  onDeleteRequest,
  isExpanded,
  onToggleExpand,
  hasChildren,
}: {
  item: CategorySettingItem;
  isChild: boolean;
  editingId: string | null;
  editingName: string;
  onStartEdit: (id: string, name: string) => void;
  onEditNameChange: (name: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDeleteRequest: (id: string, name: string) => void;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  hasChildren: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isEditing = editingId === item.id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-lg border border-border bg-card p-3 ${
        isChild ? "ml-8" : ""
      } ${item.isSection ? "border-primary/30 bg-primary/5" : ""} ${
        isDragging ? "shadow-lg z-50" : ""
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="touch-none cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground"
        aria-label="Перетащить"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {item.isSection && hasChildren && (
        <button
          onClick={() => onToggleExpand(item.id)}
          className="p-0.5 text-muted-foreground hover:text-foreground"
        >
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      )}

      {item.isSection && (
        <FolderOpen className="h-4 w-4 text-primary flex-shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex items-center gap-1">
            <Input
              value={editingName}
              onChange={(e) => onEditNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSaveEdit();
                if (e.key === "Escape") onCancelEdit();
              }}
              className="h-7 text-sm"
              autoFocus
            />
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onSaveEdit}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCancelEdit}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <span className={`text-sm truncate ${item.isSection ? "font-semibold" : ""}`}>
            {item.customName || item.name}
          </span>
        )}
      </div>

      {!isEditing && (
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => onStartEdit(item.id, item.customName || item.name)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDeleteRequest(item.id, item.customName || item.name)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

export function CategorySettingsSection({
  storeId,
  catalogs,
  categories,
  onCreateCategory,
  onRenameCategory,
  onDeleteCategory,
}: CategorySettingsSectionProps) {
  const { toast } = useToast();
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>("");
  const [items, setItems] = useState<CategorySettingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [newSectionName, setNewSectionName] = useState("");
  const [showNewSectionInput, setShowNewSectionInput] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Load catalog category settings when catalog is selected
  const loadCatalogSettings = useCallback(async () => {
    if (!selectedCatalogId || !storeId) return;

    setLoading(true);
    try {
      const { data: settings, error } = await supabase
        .from("catalog_category_settings")
        .select("*")
        .eq("catalog_id", selectedCatalogId)
        .order("sort_order", { ascending: true });

      if (error) throw error;

      const settingsMap = new Map(
        (settings || []).map((s) => [s.category_id, s])
      );

      // Build items: categories that exist in the store, enriched with catalog settings
      const result: CategorySettingItem[] = [];

      // First, add categories that have settings (in order)
      const orderedSettings = (settings || []).sort(
        (a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)
      );

      const addedIds = new Set<string>();

      for (const setting of orderedSettings) {
        const category = categories.find((c) => c.id === setting.category_id);
        if (category) {
          result.push({
            id: category.id,
            name: category.name,
            customName: setting.custom_name,
            parentCategoryId: setting.parent_category_id,
            sortOrder: setting.sort_order ?? 999,
            isSection: orderedSettings.some(
              (s) => s.parent_category_id === category.id
            ),
          });
          addedIds.add(category.id);
        }
      }

      // Then add categories without settings
      for (const cat of categories) {
        if (!addedIds.has(cat.id)) {
          result.push({
            id: cat.id,
            name: cat.name,
            customName: null,
            parentCategoryId: null,
            sortOrder: result.length,
            isSection: false,
          });
        }
      }

      setItems(result);
      setHasChanges(false);

      // Auto-expand all sections
      const sections = new Set(
        result.filter((i) => i.isSection).map((i) => i.id)
      );
      setExpandedSections(sections);
    } catch (error: any) {
      console.error("Error loading catalog settings:", error);
      toast({
        title: "Ошибка загрузки",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedCatalogId, storeId, categories, toast]);

  useEffect(() => {
    if (selectedCatalogId) {
      loadCatalogSettings();
    } else {
      setItems([]);
    }
  }, [selectedCatalogId, loadCatalogSettings]);

  // Build flat display list (parents + children interleaved)
  const displayItems = useCallback(() => {
    const parents = items.filter((i) => !i.parentCategoryId);
    const childrenMap = new Map<string, CategorySettingItem[]>();
    
    for (const item of items) {
      if (item.parentCategoryId) {
        const children = childrenMap.get(item.parentCategoryId) || [];
        children.push(item);
        childrenMap.set(item.parentCategoryId, children);
      }
    }

    const result: { item: CategorySettingItem; isChild: boolean }[] = [];
    for (const parent of parents) {
      const hasChildren = childrenMap.has(parent.id);
      // Mark as section if it has children
      result.push({ item: { ...parent, isSection: hasChildren || parent.isSection }, isChild: false });
      
      if (expandedSections.has(parent.id) || !hasChildren) {
        const children = childrenMap.get(parent.id) || [];
        for (const child of children) {
          result.push({ item: child, isChild: true });
        }
      }
    }

    return result;
  }, [items, expandedSections]);

  const flatList = displayItems();
  const sortableIds = flatList.map((f) => f.item.id);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeIdx = flatList.findIndex((f) => f.item.id === active.id);
    const overIdx = flatList.findIndex((f) => f.item.id === over.id);

    if (activeIdx === -1 || overIdx === -1) return;

    const activeItem = flatList[activeIdx].item;
    const overItem = flatList[overIdx].item;

    // If dropping a non-section onto a section, make it a child
    if (overItem.isSection && !activeItem.isSection && !flatList[activeIdx].isChild) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === activeItem.id
            ? { ...i, parentCategoryId: overItem.id }
            : i
        )
      );
      setHasChanges(true);
      return;
    }

    // If dropping onto a child, adopt same parent
    if (flatList[overIdx].isChild && !activeItem.isSection) {
      const newParent = overItem.parentCategoryId;
      setItems((prev) => {
        const updated = prev.map((i) =>
          i.id === activeItem.id
            ? { ...i, parentCategoryId: newParent }
            : i
        );
        // Reorder within the same group
        const siblings = updated.filter(
          (i) => i.parentCategoryId === newParent
        );
        const oldChildIdx = siblings.findIndex((s) => s.id === active.id);
        const newChildIdx = siblings.findIndex((s) => s.id === over.id);
        if (oldChildIdx !== -1 && newChildIdx !== -1) {
          const reordered = arrayMove(siblings, oldChildIdx, newChildIdx);
          const reorderedIds = reordered.map((r) => r.id);
          return updated.sort((a, b) => {
            if (a.parentCategoryId === newParent && b.parentCategoryId === newParent) {
              return reorderedIds.indexOf(a.id) - reorderedIds.indexOf(b.id);
            }
            return 0;
          });
        }
        return updated;
      });
      setHasChanges(true);
      return;
    }

    // Reorder top-level items
    const topLevel = items.filter((i) => !i.parentCategoryId);
    const topActiveIdx = topLevel.findIndex((t) => t.id === active.id);
    const topOverIdx = topLevel.findIndex((t) => t.id === over.id);

    if (topActiveIdx !== -1 && topOverIdx !== -1) {
      const reordered = arrayMove(topLevel, topActiveIdx, topOverIdx);
      setItems((prev) => {
        const children = prev.filter((i) => i.parentCategoryId);
        return [...reordered, ...children];
      });
      setHasChanges(true);
    }
  };

  // Save all settings
  const handleSave = async () => {
    if (!selectedCatalogId) return;

    setSaving(true);
    try {
      // Build sorted list with proper sort_order
      const parents = items.filter((i) => !i.parentCategoryId);
      let globalOrder = 0;
      const upsertData: Array<{
        catalog_id: string;
        category_id: string;
        sort_order: number;
        parent_category_id: string | null;
        custom_name: string | null;
        updated_at: string;
      }> = [];

      for (const parent of parents) {
        upsertData.push({
          catalog_id: selectedCatalogId,
          category_id: parent.id,
          sort_order: globalOrder++,
          parent_category_id: null,
          custom_name: parent.customName,
          updated_at: new Date().toISOString(),
        });

        const children = items.filter((i) => i.parentCategoryId === parent.id);
        for (const child of children) {
          upsertData.push({
            catalog_id: selectedCatalogId,
            category_id: child.id,
            sort_order: globalOrder++,
            parent_category_id: child.parentCategoryId,
            custom_name: child.customName,
            updated_at: new Date().toISOString(),
          });
        }
      }

      // Upsert all at once
      const { error } = await supabase
        .from("catalog_category_settings")
        .upsert(upsertData, { onConflict: "catalog_id,category_id" });

      if (error) throw error;

      setHasChanges(false);
      toast({
        title: "Настройки сохранены",
        description: "Порядок и иерархия категорий обновлены",
      });
    } catch (error: any) {
      console.error("Error saving category settings:", error);
      toast({
        title: "Ошибка сохранения",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Inline edit handlers
  const handleStartEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  const handleSaveEdit = () => {
    if (!editingId || !editingName.trim()) return;
    setItems((prev) =>
      prev.map((i) =>
        i.id === editingId ? { ...i, customName: editingName.trim() } : i
      )
    );
    setEditingId(null);
    setEditingName("");
    setHasChanges(true);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  // Delete
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    
    // Remove from items, also remove children if it's a section
    setItems((prev) =>
      prev.filter(
        (i) => i.id !== deleteTarget.id && i.parentCategoryId !== deleteTarget.id
      )
    );
    setDeleteTarget(null);
    setHasChanges(true);
  };

  // Toggle expand
  const handleToggleExpand = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Make a category a section (parent)
  const handleMakeSection = (id: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, isSection: true, parentCategoryId: null }
          : i
      )
    );
    setHasChanges(true);
  };

  // Remove from parent (make top-level)
  const handleRemoveFromParent = (id: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, parentCategoryId: null } : i
      )
    );
    setHasChanges(true);
  };

  // Add new section
  const handleAddSection = async () => {
    if (!newSectionName.trim() || !storeId) return;
    
    const created = await onCreateCategory(newSectionName.trim());
    if (created) {
      setItems((prev) => [
        ...prev,
        {
          id: created.id,
          name: created.name,
          customName: null,
          parentCategoryId: null,
          sortOrder: prev.length,
          isSection: true,
        },
      ]);
      setNewSectionName("");
      setShowNewSectionInput(false);
      setHasChanges(true);
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Tag className="h-5 w-5" />
          Настройки категорий
        </h2>
        <p className="text-sm text-muted-foreground">
          Настройте порядок, иерархию и названия категорий для каждого прайс-листа
        </p>
      </div>

      {/* Catalog selector */}
      <div className="max-w-md">
        <label className="text-sm font-medium text-foreground mb-1.5 block">
          Прайс-лист
        </label>
        <Select value={selectedCatalogId} onValueChange={setSelectedCatalogId}>
          <SelectTrigger>
            <SelectValue placeholder="Выберите прайс-лист..." />
          </SelectTrigger>
          <SelectContent>
            {catalogs.map((catalog) => (
              <SelectItem key={catalog.id} value={catalog.id}>
                {catalog.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedCatalogId && !loading && (
        <>
          {/* Add section button */}
          <div className="flex items-center gap-2">
            {showNewSectionInput ? (
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <Input
                  placeholder="Название раздела"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddSection();
                    if (e.key === "Escape") {
                      setShowNewSectionInput(false);
                      setNewSectionName("");
                    }
                  }}
                  autoFocus
                  className="h-9"
                />
                <Button size="sm" onClick={handleAddSection} disabled={!newSectionName.trim()}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowNewSectionInput(false);
                    setNewSectionName("");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNewSectionInput(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Добавить раздел
              </Button>
            )}
          </div>

          {/* Category list */}
          {items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Tag className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Нет категорий для отображения</p>
              <p className="text-xs mt-1">Добавьте категории к товарам в ассортименте</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
                  {flatList.map(({ item, isChild }) => (
                    <SortableCategoryItem
                      key={item.id}
                      item={item}
                      isChild={isChild}
                      editingId={editingId}
                      editingName={editingName}
                      onStartEdit={handleStartEdit}
                      onEditNameChange={setEditingName}
                      onSaveEdit={handleSaveEdit}
                      onCancelEdit={handleCancelEdit}
                      onDeleteRequest={(id, name) => setDeleteTarget({ id, name })}
                      isExpanded={expandedSections.has(item.id)}
                      onToggleExpand={handleToggleExpand}
                      hasChildren={items.some((i) => i.parentCategoryId === item.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* Save / Cancel buttons */}
          {items.length > 0 && (
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                onClick={loadCatalogSettings}
                disabled={!hasChanges || saving}
              >
                Отмена
              </Button>
              <Button onClick={handleSave} disabled={!hasChanges || saving}>
                {saving ? (
                  <>Сохранение...</>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-1" />
                    Сохранить
                  </>
                )}
              </Button>
            </div>
          )}
        </>
      )}

      {loading && (
        <div className="text-center py-12 text-muted-foreground">
          Загрузка...
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить категорию?</AlertDialogTitle>
            <AlertDialogDescription>
              Категория «{deleteTarget?.name}» будет удалена из этого прайс-листа.
              {items.some((i) => i.parentCategoryId === deleteTarget?.id) &&
                " Все подкатегории этого раздела также будут удалены."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
