import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuGroup, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Plus, Folder, FolderOpen, Inbox, MoreHorizontal, Pencil, Trash2, AlertCircle, Tag, ChevronRight, ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { AvitoProductGroup, AVITO_GROUP_COLORS, colorClass } from "@/hooks/useAvitoProductGroups";
import { AvitoFeedProduct } from "@/hooks/useAvitoFeedProducts";

interface SidebarProduct {
  id: string;
  category?: string;
  categories?: string[];
}
interface SidebarCat {
  id: string;
  name: string;
  parent_id: string | null;
}

interface Props {
  groups: AvitoProductGroup[];
  feedProducts: AvitoFeedProduct[];
  selectedGroupId: string | "all" | "none";
  onSelectGroup: (id: string | "all" | "none") => void;
  errorIds: Set<string>;
  onCreateGroup: (name: string, color?: string) => Promise<AvitoProductGroup | null>;
  onUpdateGroup: (id: string, patch: Partial<Pick<AvitoProductGroup, "name" | "color" | "sort_order">>) => Promise<void>;
  onDeleteGroup: (id: string) => Promise<void>;
  storeProducts?: SidebarProduct[];
  storeCategories?: SidebarCat[];
  selectedCategoryId?: string | null;
  onSelectCategory?: (id: string | null) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function AvitoGroupsSidebar({
  groups, feedProducts, selectedGroupId, onSelectGroup,
  errorIds, onCreateGroup, onUpdateGroup, onDeleteGroup,
  storeProducts = [], storeCategories = [], selectedCategoryId = null, onSelectCategory,
  collapsed = false, onToggleCollapse,
}: Props) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("slate");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  const totalCount = feedProducts.length;
  const noneCount = feedProducts.filter(fp => !fp.group_id).length;
  const totalErrors = feedProducts.filter(fp => errorIds.has(fp.product_id)).length;

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const g = await onCreateGroup(newName.trim(), newColor);
    if (g) {
      setNewName("");
      setCreating(false);
      onSelectGroup(g.id);
    }
  };

  const groupStats = (gid: string) => {
    const items = feedProducts.filter(fp => fp.group_id === gid);
    const errs = items.filter(fp => errorIds.has(fp.product_id)).length;
    return { count: items.length, errors: errs };
  };

  const Item = ({
    active, onClick, color, icon, label, count, errors, actions,
  }: {
    active: boolean; onClick: () => void; color?: string;
    icon: React.ReactNode; label: React.ReactNode; count: number; errors?: number;
    actions?: React.ReactNode;
  }) => (
    <div
      className={`group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-xs transition-colors ${
        active ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/60"
      }`}
      onClick={onClick}
    >
      {color ? <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${colorClass(color)}`} /> : icon}
      <span className="flex-1 truncate">{label}</span>
      {errors !== undefined && errors > 0 && (
        <span className="flex items-center gap-0.5 text-destructive text-[10px]" title={`${errors} с ошибками`}>
          <AlertCircle className="h-3 w-3" />
          {errors}
        </span>
      )}
      <Badge variant="secondary" className="text-[10px] h-4 px-1.5 min-w-[20px] justify-center">{count}</Badge>
      {actions}
    </div>
  );

  return (
    <div className="w-[220px] min-w-[200px] flex-shrink-0 border-r bg-muted/5 flex flex-col">
      <div className="p-2.5 border-b">
        <div className="flex items-center justify-between mb-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Мои категории</h3>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setCreating(v => !v)} title="Новая группа">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        {creating && (
          <div className="space-y-1.5 mt-1 p-2 rounded-md border bg-background">
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") { setCreating(false); setNewName(""); } }}
              placeholder="Название группы"
              className="h-7 text-xs"
            />
            <div className="flex flex-wrap gap-1">
              {AVITO_GROUP_COLORS.map(c => (
                <button
                  key={c.value}
                  onClick={() => setNewColor(c.value)}
                  className={`h-4 w-4 rounded-full ${c.cls} ${newColor === c.value ? "ring-2 ring-offset-1 ring-primary" : ""}`}
                  title={c.label}
                />
              ))}
            </div>
            <div className="flex gap-1">
              <Button size="sm" className="h-6 text-[10px] flex-1" onClick={handleCreate} disabled={!newName.trim()}>Создать</Button>
              <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => { setCreating(false); setNewName(""); }}>Отмена</Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        <Item
          active={selectedGroupId === "all"}
          onClick={() => onSelectGroup("all")}
          icon={<FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />}
          label="Все товары"
          count={totalCount}
          errors={totalErrors}
        />

        {groups.map(g => {
          const stats = groupStats(g.id);
          const isEditing = editingId === g.id;
          return (
            <div key={g.id}>
              {isEditing ? (
                <div className="flex items-center gap-1 px-2 py-1">
                  <Input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={async () => {
                      if (editName.trim() && editName !== g.name) await onUpdateGroup(g.id, { name: editName.trim() });
                      setEditingId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="h-6 text-xs"
                  />
                </div>
              ) : (
                <Item
                  active={selectedGroupId === g.id}
                  onClick={() => onSelectGroup(g.id)}
                  color={g.color}
                  icon={<Folder className="h-3.5 w-3.5" />}
                  label={g.name}
                  count={stats.count}
                  errors={stats.errors}
                  actions={
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="opacity-0 group-hover:opacity-100 h-5 w-5 rounded hover:bg-muted flex items-center justify-center"
                        >
                          <MoreHorizontal className="h-3 w-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuGroup>
                          <DropdownMenuItem onSelect={() => { setEditingId(g.id); setEditName(g.name); }}>
                            <Pencil className="h-3.5 w-3.5 mr-2" /> Переименовать
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          <p className="px-2 py-1 text-[10px] text-muted-foreground">Цвет</p>
                          <div className="flex flex-wrap gap-1 px-2 pb-1.5">
                            {AVITO_GROUP_COLORS.map(c => (
                              <button
                                key={c.value}
                                onClick={() => onUpdateGroup(g.id, { color: c.value })}
                                className={`h-4 w-4 rounded-full ${c.cls} ${g.color === c.value ? "ring-2 ring-offset-1 ring-primary" : ""}`}
                                title={c.label}
                              />
                            ))}
                          </div>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => {
                              if (confirm(`Удалить группу «${g.name}»? Товары останутся, но станут «Без группы».`)) {
                                onDeleteGroup(g.id);
                                if (selectedGroupId === g.id) onSelectGroup("all");
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Удалить
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  }
                />
              )}
            </div>
          );
        })}

        <div className="my-1 border-t" />
        <Item
          active={selectedGroupId === "none"}
          onClick={() => onSelectGroup("none")}
          icon={<Inbox className="h-3.5 w-3.5 text-muted-foreground" />}
          label="Без группы"
          count={noneCount}
        />

        {onSelectCategory && (() => {
          // Compute counts per category (including products in subcategories)
          const productById = new Map<string, SidebarProduct>();
          storeProducts.forEach(p => productById.set(p.id, p));
          const catById = new Map<string, SidebarCat>();
          storeCategories.forEach(c => catById.set(c.id, c));
          const childMap = new Map<string, SidebarCat[]>();
          for (const c of storeCategories) {
            if (c.parent_id) {
              const arr = childMap.get(c.parent_id) || [];
              arr.push(c); childMap.set(c.parent_id, arr);
            }
          }
          const directCount = new Map<string, number>();
          for (const fp of feedProducts) {
            const p = productById.get(fp.product_id);
            if (!p) continue;
            const ids = new Set<string>([
              ...(p.category ? [p.category] : []),
              ...(p.categories || []),
            ]);
            for (const id of ids) directCount.set(id, (directCount.get(id) || 0) + 1);
          }
          const totalCount = new Map<string, number>();
          const calc = (id: string): number => {
            if (totalCount.has(id)) return totalCount.get(id)!;
            let n = directCount.get(id) || 0;
            for (const k of childMap.get(id) || []) n += calc(k.id);
            totalCount.set(id, n);
            return n;
          };
          for (const c of storeCategories) calc(c.id);

          const roots = storeCategories.filter(c => !c.parent_id || !catById.has(c.parent_id!));
          const visibleRoots = roots.filter(r => (totalCount.get(r.id) || 0) > 0);
          if (visibleRoots.length === 0) return null;

          const toggleExpand = (id: string) => {
            setExpandedCats(prev => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id); else next.add(id);
              return next;
            });
          };

          const renderCat = (c: SidebarCat, depth: number): React.ReactNode => {
            const kids = (childMap.get(c.id) || []).filter(k => (totalCount.get(k.id) || 0) > 0);
            const expanded = expandedCats.has(c.id);
            const active = selectedCategoryId === c.id;
            return (
              <div key={c.id}>
                <div
                  className={`group flex items-center gap-1 pr-2 py-1 rounded-md cursor-pointer text-xs transition-colors ${
                    active ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/60"
                  }`}
                  style={{ paddingLeft: `${depth * 10 + 6}px` }}
                  onClick={() => onSelectCategory(active ? null : c.id)}
                >
                  {kids.length > 0 ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleExpand(c.id); }}
                      className="h-3.5 w-3.5 flex items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                      {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </button>
                  ) : (
                    <span className="w-3.5" />
                  )}
                  <Tag className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 truncate">{c.name}</span>
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 min-w-[20px] justify-center">
                    {totalCount.get(c.id) || 0}
                  </Badge>
                </div>
                {expanded && kids.map(k => renderCat(k, depth + 1))}
              </div>
            );
          };

          return (
            <>
              <div className="mt-2 mb-1 px-2 flex items-center justify-between">
                <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Категории прайса</h4>
                {selectedCategoryId && (
                  <button
                    onClick={() => onSelectCategory(null)}
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                    title="Сбросить фильтр"
                  >
                    сброс
                  </button>
                )}
              </div>
              {visibleRoots.map(r => renderCat(r, 0))}
            </>
          );
        })()}
      </div>

      <div className="p-2 border-t text-[10px] text-muted-foreground bg-muted/10">
        Эти группы — только для вашего удобства. В выгрузку Авито они не попадают.
      </div>
    </div>
  );
}

// Inline group selector (badge with dropdown) for use inside a row
export function AvitoGroupBadge({
  currentGroupId, groups, onChange, onCreateGroup, compact = false,
}: {
  currentGroupId: string | null;
  groups: AvitoProductGroup[];
  onChange: (groupId: string | null) => void;
  onCreateGroup: (name: string) => Promise<AvitoProductGroup | null>;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const current = groups.find(g => g.id === currentGroupId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] hover:bg-muted/60 ${
            current ? "border-primary/30" : "border-dashed border-muted-foreground/30 text-muted-foreground"
          }`}
          title="Группа (внутренняя категория)"
        >
          {current ? (
            <>
              <span className={`h-2 w-2 rounded-full ${colorClass(current.color)}`} />
              {!compact && <span className="truncate max-w-[80px]">{current.name}</span>}
            </>
          ) : (
            <>
              <Folder className="h-2.5 w-2.5" />
              {!compact && <span>Группа</span>}
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        <div className="max-h-[220px] overflow-y-auto">
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            className={`w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted flex items-center gap-2 ${!currentGroupId ? "font-semibold text-primary" : ""}`}
          >
            <Inbox className="h-3 w-3" /> Без группы
          </button>
          {groups.map(g => (
            <button
              key={g.id}
              onClick={() => { onChange(g.id); setOpen(false); }}
              className={`w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted flex items-center gap-2 ${currentGroupId === g.id ? "font-semibold text-primary" : ""}`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${colorClass(g.color)}`} />
              <span className="truncate">{g.name}</span>
            </button>
          ))}
        </div>
        <div className="border-t mt-1 pt-1 px-1.5 pb-1">
          <p className="text-[10px] text-muted-foreground mb-1">Создать новую</p>
          <div className="flex gap-1">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Название..."
              className="h-6 text-xs"
              onKeyDown={async (e) => {
                if (e.key === "Enter" && newName.trim()) {
                  const g = await onCreateGroup(newName.trim());
                  if (g) { onChange(g.id); setNewName(""); setOpen(false); }
                }
              }}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
