import { useState } from "react";
import { X, Trash2, Package, Tag, Check, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Product, PackagingType, MarkupSettings, ProductStatus } from "./types";
import { InlineMarkupCell } from "./InlineMarkupCell";

interface Catalog {
  id: string;
  name: string;
}

interface BulkEditPanelProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkUpdate: (updates: Partial<Product>) => void;
  onBulkDelete?: () => void;
  unitOptions: { value: string; label: string }[];
  packagingOptions: { value: string; label: string }[];
  showDelete?: boolean;
  catalogs?: Catalog[];
  onAddToCatalog?: (catalogId: string) => void;
  onCreateCatalogAndAdd?: (catalogName: string) => void;
}

export function BulkEditPanel({
  selectedCount,
  onClearSelection,
  onBulkUpdate,
  onBulkDelete,
  unitOptions,
  packagingOptions,
  showDelete = true,
  catalogs = [],
  onAddToCatalog,
  onCreateCatalogAndAdd,
}: BulkEditPanelProps) {
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [markupValue, setMarkupValue] = useState<MarkupSettings | undefined>();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddToCatalogDialog, setShowAddToCatalogDialog] = useState(false);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>("");
  const [newCatalogName, setNewCatalogName] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const handleApply = () => {
    if (!editField) return;

    let updates: Partial<Product> = {};
    
    switch (editField) {
      case "unit":
        updates.unit = editValue;
        break;
      case "packagingType":
        updates.packagingType = editValue as PackagingType;
        break;
      case "status":
        updates.status = editValue as ProductStatus;
        updates.inStock = editValue === "in_stock";
        break;
      case "inStock":
        updates.inStock = editValue === "true";
        break;
      case "markup":
        if (markupValue) {
          updates.markup = markupValue;
        }
        break;
      case "description":
        updates.description = editValue;
        break;
    }

    onBulkUpdate(updates);
    setEditField(null);
    setEditValue("");
    setMarkupValue(undefined);
  };

  const handleDelete = () => {
    setShowDeleteConfirm(false);
    onBulkDelete?.();
  };

  const handleAddToCatalog = () => {
    if (isCreatingNew && newCatalogName.trim()) {
      onCreateCatalogAndAdd?.(newCatalogName.trim());
      setShowAddToCatalogDialog(false);
      setSelectedCatalogId("");
      setNewCatalogName("");
      setIsCreatingNew(false);
    } else if (!isCreatingNew && selectedCatalogId) {
      onAddToCatalog?.(selectedCatalogId);
      setShowAddToCatalogDialog(false);
      setSelectedCatalogId("");
      setNewCatalogName("");
      setIsCreatingNew(false);
    } else if (catalogs.length === 0 && newCatalogName.trim()) {
      onCreateCatalogAndAdd?.(newCatalogName.trim());
      setShowAddToCatalogDialog(false);
      setNewCatalogName("");
    }
  };

  if (selectedCount === 0) return null;

  return (
    <>
      <div className="sticky top-0 z-10 bg-primary text-primary-foreground rounded-lg p-3 mb-4 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="font-medium">
            Выбрано: {selectedCount}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="h-7 text-primary-foreground hover:bg-primary-foreground/20"
          >
            <X className="h-4 w-4 mr-1" />
            Сбросить
          </Button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Add to catalog button */}
          {(onAddToCatalog || onCreateCatalogAndAdd) && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAddToCatalogDialog(true)}
                className="h-8"
              >
                <FolderPlus className="h-4 w-4 mr-1" />
                В прайс-лист
              </Button>
              <div className="w-px h-6 bg-primary-foreground/20 mx-1" />
            </>
          )}

          {/* Edit field selector */}
          <Select value={editField || ""} onValueChange={(v) => {
            setEditField(v);
            setEditValue("");
            setMarkupValue(undefined);
          }}>
            <SelectTrigger className="h-8 w-[140px] bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground">
              <SelectValue placeholder="Изменить..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unit">Ед. измерения</SelectItem>
              <SelectItem value="packagingType">Вид</SelectItem>
              <SelectItem value="status">Статус</SelectItem>
              <SelectItem value="markup">Наценка</SelectItem>
              <SelectItem value="description">Описание</SelectItem>
            </SelectContent>
          </Select>

          {/* Value input based on field */}
          {editField === "unit" && (
            <Select value={editValue} onValueChange={setEditValue}>
              <SelectTrigger className="h-8 w-[100px] bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground">
                <SelectValue placeholder="Выбрать" />
              </SelectTrigger>
              <SelectContent>
                {unitOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {editField === "packagingType" && (
            <Select value={editValue} onValueChange={setEditValue}>
              <SelectTrigger className="h-8 w-[120px] bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground">
                <SelectValue placeholder="Выбрать" />
              </SelectTrigger>
              <SelectContent>
                {packagingOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {editField === "status" && (
            <Select value={editValue} onValueChange={setEditValue}>
              <SelectTrigger className="h-8 w-[120px] bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground">
                <SelectValue placeholder="Выбрать" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_stock">В наличии</SelectItem>
                <SelectItem value="out_of_stock">Нет в наличии</SelectItem>
                <SelectItem value="hidden">Скрыт</SelectItem>
              </SelectContent>
            </Select>
          )}

          {editField === "markup" && (
            <div className="flex items-center gap-2 bg-primary-foreground/10 rounded px-2 py-1">
              <InlineMarkupCell
                value={markupValue}
                onSave={setMarkupValue}
                className="text-primary-foreground"
              />
            </div>
          )}

          {editField === "description" && (
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="Новое описание..."
              className="h-8 w-[200px] bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50"
            />
          )}

          {editField && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleApply}
              disabled={editField === "markup" ? !markupValue : !editValue}
              className="h-8"
            >
              <Check className="h-4 w-4 mr-1" />
              Применить
            </Button>
          )}

          {showDelete && (
            <>
              <div className="w-px h-6 bg-primary-foreground/20 mx-1" />

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                className="h-8 text-primary-foreground hover:bg-destructive hover:text-destructive-foreground"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Удалить
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить товары?</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить {selectedCount} товар(ов)? Это действие нельзя отменить.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to catalog dialog */}
      <Dialog open={showAddToCatalogDialog} onOpenChange={(open) => {
        setShowAddToCatalogDialog(open);
        if (!open) {
          setIsCreatingNew(false);
          setSelectedCatalogId("");
          setNewCatalogName("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить в прайс-лист</DialogTitle>
            <DialogDescription>
              {catalogs.length > 0 
                ? `Выберите прайс-лист или создайте новый для ${selectedCount} товар(ов)`
                : `Создайте новый прайс-лист для ${selectedCount} товар(ов)`
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            {catalogs.length > 0 && !isCreatingNew && (
              <div className="space-y-2">
                <Label>Выбрать существующий прайс-лист</Label>
                <Select value={selectedCatalogId} onValueChange={setSelectedCatalogId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите прайс-лист..." />
                  </SelectTrigger>
                  <SelectContent>
                    {catalogs.map(catalog => (
                      <SelectItem key={catalog.id} value={catalog.id}>
                        {catalog.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {catalogs.length > 0 && !isCreatingNew && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">или</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}

            {(catalogs.length === 0 || isCreatingNew) ? (
              <div className="space-y-2">
                <Label>Название нового прайс-листа</Label>
                <Input
                  value={newCatalogName}
                  onChange={(e) => setNewCatalogName(e.target.value)}
                  placeholder="Введите название..."
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newCatalogName.trim()) {
                      handleAddToCatalog();
                    }
                  }}
                />
                {catalogs.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsCreatingNew(false);
                      setNewCatalogName("");
                    }}
                    className="text-xs text-muted-foreground"
                  >
                    ← Назад к выбору
                  </Button>
                )}
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setIsCreatingNew(true);
                  setSelectedCatalogId("");
                }}
              >
                <FolderPlus className="h-4 w-4 mr-2" />
                Создать новый прайс-лист
              </Button>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddToCatalogDialog(false);
              setSelectedCatalogId("");
              setNewCatalogName("");
              setIsCreatingNew(false);
            }}>
              Отмена
            </Button>
            <Button 
              onClick={handleAddToCatalog}
              disabled={isCreatingNew || catalogs.length === 0 ? !newCatalogName.trim() : !selectedCatalogId}
            >
              <FolderPlus className="h-4 w-4 mr-1" />
              {isCreatingNew || catalogs.length === 0 ? "Создать и добавить" : "Добавить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
