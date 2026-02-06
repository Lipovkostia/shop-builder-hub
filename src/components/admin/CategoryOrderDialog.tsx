import { useState, useEffect, useCallback } from "react";
import { GripVertical, ChevronRight, CornerDownRight } from "lucide-react";
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
  DragOverEvent,
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

interface Category {
  id: string;
  name: string;
  sort_order: number | null;
  parent_id?: string | null;
  catalog_parent_id?: string | null;
}

export interface CategoryHierarchyItem {
  id: string;
  parent_id: string | null;
  sort_order: number;
}

interface CategoryOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  onSave: (items: CategoryHierarchyItem[]) => Promise<void>;
  catalogId?: string | null;
  catalogName?: string;
}

interface CategoryNode {
  id: string;
  name: string;
  parent_id: string | null;
  children: CategoryNode[];
}

function SortableCategoryItem({ 
  category, 
  isChild = false,
  onMakeRoot,
}: { 
  category: CategoryNode; 
  isChild?: boolean;
  onMakeRoot?: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-2.5 bg-background border rounded-lg transition-all ${
        isDragging ? "opacity-50 shadow-lg ring-2 ring-primary" : ""
      } ${isOver ? "ring-2 ring-primary/50" : ""} ${isChild ? "ml-6" : ""}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded touch-none"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      
      {isChild && (
        <CornerDownRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      )}
      
      <span className={`flex-1 text-sm ${isChild ? "" : "font-semibold"}`}>
        {category.name}
      </span>
      
      {isChild && onMakeRoot && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => onMakeRoot(category.id)}
        >
          ↑ Главная
        </Button>
      )}
    </div>
  );
}

function DragOverlayItem({ category, isChild }: { category: CategoryNode; isChild: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2.5 bg-background border rounded-lg shadow-xl ring-2 ring-primary ${isChild ? "ml-6" : ""}`}>
      <GripVertical className="h-4 w-4 text-muted-foreground" />
      {isChild && <CornerDownRight className="h-3 w-3 text-muted-foreground" />}
      <span className={`flex-1 text-sm ${isChild ? "" : "font-semibold"}`}>
        {category.name}
      </span>
    </div>
  );
}

export function CategoryOrderDialog({
  open,
  onOpenChange,
  categories,
  onSave,
  catalogId,
  catalogName,
}: CategoryOrderDialogProps) {
  const [hierarchy, setHierarchy] = useState<Map<string | null, string[]>>(new Map());
  const [categoryMap, setCategoryMap] = useState<Map<string, CategoryNode>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Build hierarchy from categories
  useEffect(() => {
    if (open) {
      const newHierarchy = new Map<string | null, string[]>();
      const newCategoryMap = new Map<string, CategoryNode>();
      
      // Sort categories by sort_order first
      const sorted = [...categories].sort((a, b) => {
        const orderA = a.sort_order ?? 999999;
        const orderB = b.sort_order ?? 999999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });
      
      // Build category nodes and hierarchy
      sorted.forEach(cat => {
        const parentId = cat.catalog_parent_id ?? cat.parent_id ?? null;
        
        newCategoryMap.set(cat.id, {
          id: cat.id,
          name: cat.name,
          parent_id: parentId,
          children: [],
        });
        
        if (!newHierarchy.has(parentId)) {
          newHierarchy.set(parentId, []);
        }
        newHierarchy.get(parentId)!.push(cat.id);
      });
      
      setHierarchy(newHierarchy);
      setCategoryMap(newCategoryMap);
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

  // Get flat list of all category IDs for SortableContext
  const getAllCategoryIds = useCallback((): string[] => {
    const result: string[] = [];
    const roots = hierarchy.get(null) || [];
    
    roots.forEach(rootId => {
      result.push(rootId);
      const children = hierarchy.get(rootId) || [];
      children.forEach(childId => result.push(childId));
    });
    
    return result;
  }, [hierarchy]);

  // Find parent of a category
  const findParent = useCallback((categoryId: string): string | null => {
    const cat = categoryMap.get(categoryId);
    return cat?.parent_id || null;
  }, [categoryMap]);

  // Check if dragged item is a child
  const isChild = useCallback((categoryId: string): boolean => {
    return findParent(categoryId) !== null;
  }, [findParent]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    
    const activeId = active.id as string;
    const overId = over.id as string;
    
    if (activeId === overId) return;
    
    // Don't allow nesting more than one level deep
    const overParent = findParent(overId);
    if (overParent !== null) {
      // Over item is a child, so we're reordering within same parent
      return;
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (!over) return;
    
    const activeId = active.id as string;
    const overId = over.id as string;
    
    if (activeId === overId) return;
    
    setHierarchy(prev => {
      const newHierarchy = new Map(prev);
      
      const activeParent = findParent(activeId);
      const overParent = findParent(overId);
      
      // Same parent - just reorder
      if (activeParent === overParent) {
        const parentList = [...(newHierarchy.get(activeParent) || [])];
        const oldIndex = parentList.indexOf(activeId);
        const newIndex = parentList.indexOf(overId);
        
        if (oldIndex !== -1 && newIndex !== -1) {
          newHierarchy.set(activeParent, arrayMove(parentList, oldIndex, newIndex));
        }
      } else if (overParent === null && activeParent !== null) {
        // Moving child to become root (dropped on a root item)
        // Remove from old parent
        const oldParentList = [...(newHierarchy.get(activeParent) || [])];
        const oldIndex = oldParentList.indexOf(activeId);
        if (oldIndex !== -1) {
          oldParentList.splice(oldIndex, 1);
          newHierarchy.set(activeParent, oldParentList);
        }
        
        // Add to root level at position of over item
        const rootList = [...(newHierarchy.get(null) || [])];
        const overIndex = rootList.indexOf(overId);
        rootList.splice(overIndex, 0, activeId);
        newHierarchy.set(null, rootList);
        
        // Update category map
        setCategoryMap(prevMap => {
          const newMap = new Map(prevMap);
          const cat = newMap.get(activeId);
          if (cat) {
            newMap.set(activeId, { ...cat, parent_id: null });
          }
          return newMap;
        });
      } else if (overParent === null && activeParent === null) {
        // Reordering root items - but check if dropping ON item to make it a child
        // For now, just reorder
        const rootList = [...(newHierarchy.get(null) || [])];
        const oldIndex = rootList.indexOf(activeId);
        const newIndex = rootList.indexOf(overId);
        
        if (oldIndex !== -1 && newIndex !== -1) {
          newHierarchy.set(null, arrayMove(rootList, oldIndex, newIndex));
        }
      }
      
      return newHierarchy;
    });
  };

  // Make a child category into a root category
  const handleMakeRoot = useCallback((categoryId: string) => {
    const currentParent = findParent(categoryId);
    if (currentParent === null) return;
    
    setHierarchy(prev => {
      const newHierarchy = new Map(prev);
      
      // Remove from parent
      const parentList = [...(newHierarchy.get(currentParent) || [])];
      const index = parentList.indexOf(categoryId);
      if (index !== -1) {
        parentList.splice(index, 1);
        newHierarchy.set(currentParent, parentList);
      }
      
      // Add to roots
      const rootList = [...(newHierarchy.get(null) || [])];
      rootList.push(categoryId);
      newHierarchy.set(null, rootList);
      
      return newHierarchy;
    });
    
    setCategoryMap(prev => {
      const newMap = new Map(prev);
      const cat = newMap.get(categoryId);
      if (cat) {
        newMap.set(categoryId, { ...cat, parent_id: null });
      }
      return newMap;
    });
  }, [findParent]);

  // Make a root category into a child of the previous root
  const handleMakeChild = useCallback((categoryId: string) => {
    const rootList = hierarchy.get(null) || [];
    const index = rootList.indexOf(categoryId);
    
    if (index <= 0) return; // Can't make first item a child
    
    const newParentId = rootList[index - 1];
    
    setHierarchy(prev => {
      const newHierarchy = new Map(prev);
      
      // Remove from roots
      const newRootList = [...rootList];
      newRootList.splice(index, 1);
      newHierarchy.set(null, newRootList);
      
      // Add to new parent
      const parentChildren = [...(newHierarchy.get(newParentId) || [])];
      parentChildren.push(categoryId);
      newHierarchy.set(newParentId, parentChildren);
      
      return newHierarchy;
    });
    
    setCategoryMap(prev => {
      const newMap = new Map(prev);
      const cat = newMap.get(categoryId);
      if (cat) {
        newMap.set(categoryId, { ...cat, parent_id: newParentId });
      }
      return newMap;
    });
  }, [hierarchy]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const items: CategoryHierarchyItem[] = [];
      let sortOrder = 0;
      
      // Build flat list with proper sort_order and parent_id
      const roots = hierarchy.get(null) || [];
      roots.forEach(rootId => {
        const cat = categoryMap.get(rootId);
        if (cat) {
          items.push({
            id: rootId,
            parent_id: null,
            sort_order: sortOrder++,
          });
          
          // Add children
          const children = hierarchy.get(rootId) || [];
          children.forEach(childId => {
            items.push({
              id: childId,
              parent_id: rootId,
              sort_order: sortOrder++,
            });
          });
        }
      });
      
      await onSave(items);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const activeCategory = activeId ? categoryMap.get(activeId) : null;
  const roots = hierarchy.get(null) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {catalogId && catalogName 
              ? `Порядок категорий: ${catalogName}`
              : "Порядок отображения категорий"
            }
          </DialogTitle>
          {catalogId && (
            <p className="text-sm text-muted-foreground">
              Перетащите категорию на другую, чтобы сделать подкатегорией. Жирные — главные категории.
            </p>
          )}
        </DialogHeader>
        <div className="py-4">
          {roots.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Нет категорий для сортировки
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={getAllCategoryIds()}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-1.5 max-h-[400px] overflow-y-auto pr-1">
                  {roots.map((rootId, rootIndex) => {
                    const rootCat = categoryMap.get(rootId);
                    if (!rootCat) return null;
                    
                    const children = hierarchy.get(rootId) || [];
                    
                    return (
                      <div key={rootId}>
                        {/* Root category with option to make it a child */}
                        <div className="flex items-center gap-1">
                          <div className="flex-1">
                            <SortableCategoryItem 
                              category={rootCat}
                              isChild={false}
                            />
                          </div>
                          {rootIndex > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground flex-shrink-0"
                              onClick={() => handleMakeChild(rootId)}
                              title="Сделать подкатегорией"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        
                        {/* Children */}
                        {children.map(childId => {
                          const childCat = categoryMap.get(childId);
                          if (!childCat) return null;
                          
                          return (
                            <SortableCategoryItem
                              key={childId}
                              category={childCat}
                              isChild={true}
                              onMakeRoot={handleMakeRoot}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </SortableContext>
              
              <DragOverlay>
                {activeCategory && (
                  <DragOverlayItem 
                    category={activeCategory} 
                    isChild={isChild(activeCategory.id)}
                  />
                )}
              </DragOverlay>
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
