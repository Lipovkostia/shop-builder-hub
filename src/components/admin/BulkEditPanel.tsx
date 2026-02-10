import { useState } from "react";
import { X, Trash2, Package, Tag, Check, FolderPlus, FolderMinus, Wand2, ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Product, PackagingType, MarkupSettings, ProductStatus } from "./types";
import { InlineMarkupCell } from "./InlineMarkupCell";
import { ChevronDown, Layers } from "lucide-react";

interface Catalog {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  sort_order?: number | null;
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
  onRemoveFromCatalog?: () => void;
  currentCatalogName?: string;
  // New props for bulk category editing
  categories?: Category[];
  onBulkSetCategories?: (categoryIds: string[]) => void;
  onBulkClearCategories?: () => void;
  // Bulk auto-fill categories from other price lists
  onBulkAutoFillCategories?: (mode: "fill_empty" | "replace_all") => void;
  // Bulk price editing
  onBulkSetPrice?: (price: number) => void;
  // Bulk best photo
  onBulkBestPhoto?: () => Promise<void>;
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
  onRemoveFromCatalog,
  currentCatalogName,
  categories = [],
  onBulkSetCategories,
  onBulkClearCategories,
  onBulkAutoFillCategories,
  onBulkSetPrice,
  onBulkBestPhoto,
}: BulkEditPanelProps) {
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [markupValue, setMarkupValue] = useState<MarkupSettings | undefined>();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRemoveFromCatalogConfirm, setShowRemoveFromCatalogConfirm] = useState(false);
  const [showAddToCatalogDialog, setShowAddToCatalogDialog] = useState(false);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>("");
  const [newCatalogName, setNewCatalogName] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  // Category bulk editing state
  const [selectedBulkCategories, setSelectedBulkCategories] = useState<string[]>([]);
  const [isCategoryPopoverOpen, setIsCategoryPopoverOpen] = useState(false);
  const [isAutoFillPopoverOpen, setIsAutoFillPopoverOpen] = useState(false);
  const [isBestPhotoProcessing, setIsBestPhotoProcessing] = useState(false);

  const handleApply = () => {
    if (!editField) return;

    if (editField === "price" && onBulkSetPrice) {
      const numValue = parseFloat(editValue);
      if (!isNaN(numValue) && numValue >= 0) {
        onBulkSetPrice(numValue);
      }
      setEditField(null);
      setEditValue("");
      return;
    }

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

  const handleRemoveFromCatalog = () => {
    setShowRemoveFromCatalogConfirm(false);
    onRemoveFromCatalog?.();
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

  const handleApplyCategories = () => {
    if (onBulkSetCategories && selectedBulkCategories.length > 0) {
      onBulkSetCategories(selectedBulkCategories);
      setSelectedBulkCategories([]);
      setIsCategoryPopoverOpen(false);
    }
  };

  const toggleCategorySelection = (categoryId: string) => {
    setSelectedBulkCategories(prev => 
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
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
          {/* Remove from catalog button */}
          {onRemoveFromCatalog && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowRemoveFromCatalogConfirm(true)}
                className="h-8 bg-destructive/20 hover:bg-destructive/30 text-primary-foreground"
              >
                <FolderMinus className="h-4 w-4 mr-1" />
                Убрать из прайс-листа
              </Button>
              <div className="w-px h-6 bg-primary-foreground/20 mx-1" />
            </>
          )}

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

          {/* Bulk category editing */}
          {onBulkSetCategories && categories.length > 0 && (
            <>
              <Popover open={isCategoryPopoverOpen} onOpenChange={(open) => {
                setIsCategoryPopoverOpen(open);
                if (!open) setSelectedBulkCategories([]);
              }}>
                <PopoverTrigger asChild>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8"
                  >
                    <Layers className="h-4 w-4 mr-1" />
                    Категории
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="start">
                  <div className="text-sm font-medium mb-2">Установить категории</div>
                  <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto mb-3">
                    {categories
                      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                      .map((category) => {
                        const isSelected = selectedBulkCategories.includes(category.id);
                        return (
                          <div
                            key={category.id}
                            onClick={() => toggleCategorySelection(category.id)}
                            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                          >
                            <Checkbox 
                              checked={isSelected} 
                              className="h-4 w-4 pointer-events-none" 
                            />
                            <span className="text-sm truncate">{category.name}</span>
                          </div>
                        );
                      })}
                    {categories.length === 0 && (
                      <p className="text-sm text-muted-foreground px-2 py-1">Нет категорий</p>
                    )}
                  </div>
                  {onBulkClearCategories && (
                    <>
                      <div className="border-t my-1" />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          onBulkClearCategories();
                          setIsCategoryPopoverOpen(false);
                        }}
                        className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Снять все категории
                      </Button>
                    </>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleApplyCategories}
                      disabled={selectedBulkCategories.length === 0}
                      className="flex-1"
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Применить
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedBulkCategories([]);
                        setIsCategoryPopoverOpen(false);
                      }}
                    >
                      Отмена
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
               <div className="w-px h-6 bg-primary-foreground/20 mx-1" />
            </>
          )}

          {/* Bulk best photo */}
          {onBulkBestPhoto && (
            <>
              <Button
                variant="secondary"
                size="sm"
                className="h-8"
                disabled={isBestPhotoProcessing}
                onClick={async () => {
                  setIsBestPhotoProcessing(true);
                  try {
                    await onBulkBestPhoto();
                  } finally {
                    setIsBestPhotoProcessing(false);
                  }
                }}
              >
                {isBestPhotoProcessing ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4 mr-1" />
                )}
                Лучшее фото
              </Button>
              <div className="w-px h-6 bg-primary-foreground/20 mx-1" />
            </>
          )}

          {/* Auto-fill categories from other price lists */}
          {onBulkAutoFillCategories && (
            <>
              <Popover open={isAutoFillPopoverOpen} onOpenChange={setIsAutoFillPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8"
                  >
                    <Wand2 className="h-4 w-4 mr-1" />
                    Подставить категории
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3" align="start">
                  <div className="text-sm font-medium mb-2">Подставить категории из других прайс-листов</div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Для выбранных товаров будут скопированы категории из других прайс-листов, где они уже назначены.
                  </p>
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onBulkAutoFillCategories("fill_empty");
                        setIsAutoFillPopoverOpen(false);
                      }}
                      className="justify-start"
                    >
                      Только пустые
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onBulkAutoFillCategories("replace_all");
                        setIsAutoFillPopoverOpen(false);
                      }}
                      className="justify-start"
                    >
                      Заменить все
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
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
              {onBulkSetPrice && <SelectItem value="price">Цена</SelectItem>}
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
                <SelectItem value="pre_order">Под заказ</SelectItem>
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

          {editField === "price" && (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="Цена ₽"
                min="0"
                step="0.01"
                className="h-8 w-[120px] bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-primary-foreground/70 text-xs">₽</span>
            </div>
          )}

          {editField && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleApply}
              disabled={editField === "markup" ? !markupValue : editField === "price" ? !editValue || isNaN(parseFloat(editValue)) : !editValue}
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

      {/* Remove from catalog confirmation dialog */}
      <Dialog open={showRemoveFromCatalogConfirm} onOpenChange={setShowRemoveFromCatalogConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Убрать товары из прайс-листа?</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите убрать {selectedCount} товар(ов) из прайс-листа{currentCatalogName ? ` "${currentCatalogName}"` : ""}? 
              Товары останутся в ассортименте и других прайс-листах.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRemoveFromCatalogConfirm(false)}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={handleRemoveFromCatalog}>
              Убрать
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
