import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, X, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ExchangeCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string | null;
  onSubmit: (items: { product_id?: string; custom_name?: string; unit?: string }[]) => Promise<void>;
}

interface SimpleProduct {
  id: string;
  name: string;
  unit: string;
}

export function ExchangeCreateDialog({ open, onOpenChange, storeId, onSubmit }: ExchangeCreateDialogProps) {
  const [products, setProducts] = useState<SimpleProduct[]>([]);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [customItems, setCustomItems] = useState<{ name: string; unit: string }[]>([]);
  const [customName, setCustomName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !storeId) return;
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, unit")
        .eq("store_id", storeId)
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("name");
      setProducts((data || []) as SimpleProduct[]);
    })();
  }, [open, storeId]);

  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set());
      setCustomItems([]);
      setCustomName("");
      setSearch("");
    }
  }, [open]);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleProduct = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addCustomItem = () => {
    const trimmed = customName.trim();
    if (!trimmed) return;
    setCustomItems((prev) => [...prev, { name: trimmed, unit: "шт" }]);
    setCustomName("");
  };

  const removeCustomItem = (index: number) => {
    setCustomItems((prev) => prev.filter((_, i) => i !== index));
  };

  const totalCount = selectedIds.size + customItems.length;

  const handleSubmit = async () => {
    if (totalCount === 0) return;
    setSubmitting(true);

    const items: { product_id?: string; custom_name?: string; unit?: string }[] = [];

    selectedIds.forEach((id) => {
      const p = products.find((pr) => pr.id === id);
      items.push({ product_id: id, unit: p?.unit || "шт" });
    });

    customItems.forEach((ci) => {
      items.push({ custom_name: ci.name, unit: ci.unit });
    });

    await onSubmit(items);
    setSubmitting(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Новая заявка на биржу</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 flex-1 min-h-0 flex flex-col">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по ассортименту..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          {/* Product list */}
          <ScrollArea className="flex-1 min-h-0 max-h-[250px] border rounded-md">
            <div className="p-1 space-y-0.5">
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {search ? "Ничего не найдено" : "Нет товаров в ассортименте"}
                </p>
              ) : (
                filtered.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedIds.has(p.id)}
                      onCheckedChange={() => toggleProduct(p.id)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm truncate flex-1">{p.name}</span>
                    <span className="text-xs text-muted-foreground">{p.unit || "шт"}</span>
                  </label>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Add custom item */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Добавить свой товар..."
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustomItem()}
              className="h-9 flex-1"
            />
            <Button variant="outline" size="sm" onClick={addCustomItem} disabled={!customName.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Selected items summary */}
          {totalCount > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Выбрано: {totalCount} поз.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(selectedIds).map((id) => {
                  const p = products.find((pr) => pr.id === id);
                  return (
                    <Badge
                      key={id}
                      variant="secondary"
                      className="text-xs cursor-pointer hover:bg-destructive/10"
                      onClick={() => toggleProduct(id)}
                    >
                      {p?.name || id}
                      <X className="h-3 w-3 ml-1" />
                    </Badge>
                  );
                })}
                {customItems.map((ci, idx) => (
                  <Badge
                    key={`custom-${idx}`}
                    variant="outline"
                    className="text-xs cursor-pointer hover:bg-destructive/10"
                    onClick={() => removeCustomItem(idx)}
                  >
                    {ci.name}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={totalCount === 0 || submitting}>
            <Send className="h-4 w-4 mr-1" />
            Отправить на биржу
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
