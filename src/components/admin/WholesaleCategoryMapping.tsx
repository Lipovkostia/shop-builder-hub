import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Loader2, Save, RotateCcw, ArrowRight, Check, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CategoryMapping {
  id: string;               // category id
  originalName: string;     // from categories table
  customName: string;       // from catalog_category_settings or same as original
  parentId: string | null;
  sortOrder: number | null;
  hasCustomName: boolean;
  settingId: string | null;  // catalog_category_settings id
}

interface WholesaleCategoryMappingProps {
  storeId: string | null;
  catalogId: string | null;
}

export function WholesaleCategoryMapping({ storeId, catalogId }: WholesaleCategoryMappingProps) {
  const [mappings, setMappings] = useState<CategoryMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = useCallback(async () => {
    if (!storeId || !catalogId) {
      setMappings([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch all store categories
      const { data: categories, error: catError } = await supabase
        .from("categories")
        .select("id, name, slug, parent_id, sort_order")
        .eq("store_id", storeId)
        .order("sort_order");

      if (catError) throw catError;

      // Fetch existing catalog_category_settings for this catalog
      const { data: settings, error: settError } = await supabase
        .from("catalog_category_settings")
        .select("id, category_id, custom_name, sort_order")
        .eq("catalog_id", catalogId);

      if (settError) throw settError;

      const settingsMap = new Map((settings || []).map(s => [s.category_id, s]));

      const result: CategoryMapping[] = (categories || []).map(cat => {
        const setting = settingsMap.get(cat.id);
        return {
          id: cat.id,
          originalName: cat.name,
          customName: setting?.custom_name || cat.name,
          parentId: cat.parent_id,
          sortOrder: setting?.sort_order ?? cat.sort_order,
          hasCustomName: !!setting?.custom_name,
          settingId: setting?.id || null,
        };
      });

      setMappings(result);
    } catch (err) {
      console.error("Error fetching category mappings:", err);
      toast.error("Ошибка загрузки категорий");
    } finally {
      setLoading(false);
    }
  }, [storeId, catalogId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const startEdit = (cat: CategoryMapping) => {
    setEditingId(cat.id);
    setEditValue(cat.customName);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const saveCustomName = async (catId: string) => {
    if (!catalogId) return;
    setSaving(true);

    const mapping = mappings.find(m => m.id === catId);
    if (!mapping) return;

    const newName = editValue.trim();
    const isReset = newName === mapping.originalName || newName === "";

    try {
      if (mapping.settingId) {
        // Update existing
        await supabase
          .from("catalog_category_settings")
          .update({
            custom_name: isReset ? null : newName,
            updated_at: new Date().toISOString(),
          })
          .eq("id", mapping.settingId);
      } else if (!isReset) {
        // Insert new
        await supabase
          .from("catalog_category_settings")
          .insert({
            catalog_id: catalogId,
            category_id: catId,
            custom_name: newName,
          });
      }

      setMappings(prev => prev.map(m =>
        m.id === catId
          ? { ...m, customName: isReset ? m.originalName : newName, hasCustomName: !isReset }
          : m
      ));
      setEditingId(null);
      toast.success(isReset ? "Название сброшено" : "Название сохранено");
      fetchData(); // refresh to get settingId
    } catch (err) {
      console.error("Error saving custom name:", err);
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const resetName = async (catId: string) => {
    if (!catalogId) return;
    const mapping = mappings.find(m => m.id === catId);
    if (!mapping?.settingId) return;

    setSaving(true);
    try {
      await supabase
        .from("catalog_category_settings")
        .update({ custom_name: null, updated_at: new Date().toISOString() })
        .eq("id", mapping.settingId);

      setMappings(prev => prev.map(m =>
        m.id === catId ? { ...m, customName: m.originalName, hasCustomName: false } : m
      ));
      toast.success("Название сброшено к оригиналу");
    } catch (err) {
      console.error("Error resetting name:", err);
      toast.error("Ошибка сброса");
    } finally {
      setSaving(false);
    }
  };

  // Build parent-child structure for display
  const roots = useMemo(() => {
    const map = new Map(mappings.map(m => [m.id, { ...m, children: [] as CategoryMapping[] }]));
    const rootList: (CategoryMapping & { children: CategoryMapping[] })[] = [];

    mappings.forEach(m => {
      const node = map.get(m.id)!;
      if (m.parentId && map.has(m.parentId)) {
        map.get(m.parentId)!.children.push(node);
      } else {
        rootList.push(node);
      }
    });

    return rootList;
  }, [mappings]);

  const filteredRoots = useMemo(() => {
    if (!searchQuery.trim()) return roots;
    const q = searchQuery.toLowerCase();
    return roots.filter(r =>
      r.originalName.toLowerCase().includes(q) ||
      r.customName.toLowerCase().includes(q) ||
      r.children.some(c => c.originalName.toLowerCase().includes(q) || c.customName.toLowerCase().includes(q))
    );
  }, [roots, searchQuery]);

  const customCount = mappings.filter(m => m.hasCustomName).length;

  if (!catalogId) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Сначала выберите прайс-лист для оптового магазина на вкладке «Общее»
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Сопоставление категорий</h3>
          <p className="text-xs text-muted-foreground">
            Задайте свои названия категорий для отображения на сайте. {customCount > 0 && (
              <span className="text-primary">Переименовано: {customCount}</span>
            )}
          </p>
        </div>
      </div>

      <div className="relative">
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Поиск категорий..."
          className="h-9 text-sm"
        />
      </div>

      <ScrollArea className="h-[calc(100vh-420px)] min-h-[300px] border border-border rounded-lg">
        <div className="divide-y divide-border">
          {filteredRoots.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Категории не найдены</div>
          ) : (
            filteredRoots.map(root => (
              <React.Fragment key={root.id}>
                <CategoryRow
                  mapping={root}
                  depth={0}
                  editingId={editingId}
                  editValue={editValue}
                  saving={saving}
                  onStartEdit={startEdit}
                  onCancelEdit={cancelEdit}
                  onSave={saveCustomName}
                  onReset={resetName}
                  onEditValueChange={setEditValue}
                />
                {root.children.map(child => (
                  <CategoryRow
                    key={child.id}
                    mapping={child}
                    depth={1}
                    editingId={editingId}
                    editValue={editValue}
                    saving={saving}
                    onStartEdit={startEdit}
                    onCancelEdit={cancelEdit}
                    onSave={saveCustomName}
                    onReset={resetName}
                    onEditValueChange={setEditValue}
                  />
                ))}
              </React.Fragment>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function CategoryRow({
  mapping,
  depth,
  editingId,
  editValue,
  saving,
  onStartEdit,
  onCancelEdit,
  onSave,
  onReset,
  onEditValueChange,
}: {
  mapping: CategoryMapping;
  depth: number;
  editingId: string | null;
  editValue: string;
  saving: boolean;
  onStartEdit: (m: CategoryMapping) => void;
  onCancelEdit: () => void;
  onSave: (id: string) => void;
  onReset: (id: string) => void;
  onEditValueChange: (v: string) => void;
}) {
  const isEditing = editingId === mapping.id;

  return (
    <div className={cn("px-4 py-3 flex items-center gap-3", depth > 0 && "pl-10 bg-muted/20")}>
      {/* Original name */}
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm truncate", depth === 0 ? "font-semibold" : "font-normal")}>
          {mapping.originalName}
        </p>
        {mapping.hasCustomName && !isEditing && (
          <p className="text-xs text-muted-foreground">из МойСклад</p>
        )}
      </div>

      <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />

      {/* Custom name / edit */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex items-center gap-1.5">
            <Input
              value={editValue}
              onChange={e => onEditValueChange(e.target.value)}
              className="h-8 text-sm"
              autoFocus
              onKeyDown={e => {
                if (e.key === "Enter") onSave(mapping.id);
                if (e.key === "Escape") onCancelEdit();
              }}
            />
            <Button size="sm" variant="ghost" onClick={() => onSave(mapping.id)} disabled={saving} className="h-8 w-8 p-0">
              <Check className="h-4 w-4 text-primary" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <p className={cn(
              "text-sm truncate",
              mapping.hasCustomName ? "text-primary font-medium" : "text-muted-foreground"
            )}>
              {mapping.customName}
            </p>
            {mapping.hasCustomName && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20">
                своё
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {!isEditing && (
          <>
            <Button size="sm" variant="ghost" onClick={() => onStartEdit(mapping)} className="h-7 w-7 p-0">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            {mapping.hasCustomName && (
              <Button size="sm" variant="ghost" onClick={() => onReset(mapping.id)} disabled={saving} className="h-7 w-7 p-0">
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
