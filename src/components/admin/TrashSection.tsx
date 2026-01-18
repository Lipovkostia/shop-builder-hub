import React, { useState } from "react";
import { Trash2, RotateCcw, AlertTriangle, Package, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useTrashProducts, TrashedProduct } from "@/hooks/useTrashProducts";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

interface TrashSectionProps {
  storeId: string | null;
}

export function TrashSection({ storeId }: TrashSectionProps) {
  const {
    trashedProducts,
    loading,
    restoreProduct,
    restoreProducts,
    permanentlyDeleteProduct,
    permanentlyDeleteProducts,
    emptyTrash,
  } = useTrashProducts(storeId);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isEmptyingTrash, setIsEmptyingTrash] = useState(false);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const [isRestoringSelected, setIsRestoringSelected] = useState(false);

  // Filter products by search
  const filteredProducts = trashedProducts.filter((product) =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  const handleRestoreSelected = async () => {
    setIsRestoringSelected(true);
    await restoreProducts(Array.from(selectedIds));
    setSelectedIds(new Set());
    setIsRestoringSelected(false);
  };

  const handleDeleteSelected = async () => {
    setIsDeletingSelected(true);
    await permanentlyDeleteProducts(Array.from(selectedIds));
    setSelectedIds(new Set());
    setIsDeletingSelected(false);
  };

  const handleEmptyTrash = async () => {
    setIsEmptyingTrash(true);
    await emptyTrash();
    setSelectedIds(new Set());
    setIsEmptyingTrash(false);
  };

  const formatDeletedAt = (deletedAt: string) => {
    try {
      return formatDistanceToNow(new Date(deletedAt), { addSuffix: true, locale: ru });
    } catch {
      return "—";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Загрузка...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Корзина</h2>
          {trashedProducts.length > 0 && (
            <Badge variant="secondary">{trashedProducts.length}</Badge>
          )}
        </div>

        {trashedProducts.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={isEmptyingTrash}>
                {isEmptyingTrash ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Очистить корзину
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Очистить корзину?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Все {trashedProducts.length} товаров будут удалены навсегда. 
                  Это действие нельзя отменить.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleEmptyTrash}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Удалить всё
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {trashedProducts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Trash2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>Корзина пуста</p>
          <p className="text-sm mt-1">Удалённые товары будут отображаться здесь</p>
        </div>
      ) : (
        <>
          {/* Search and bulk actions */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по названию..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {selectedIds.size > 0 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRestoreSelected}
                  disabled={isRestoringSelected}
                >
                  {isRestoringSelected ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RotateCcw className="h-4 w-4 mr-2" />
                  )}
                  Восстановить ({selectedIds.size})
                </Button>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={isDeletingSelected}>
                      {isDeletingSelected ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Удалить ({selectedIds.size})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        Удалить навсегда?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {selectedIds.size} товаров будут удалены безвозвратно. 
                        Это действие нельзя отменить.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Отмена</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteSelected}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Удалить навсегда
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-14">Фото</TableHead>
                  <TableHead>Название</TableHead>
                  <TableHead className="hidden sm:table-cell">Цена</TableHead>
                  <TableHead className="hidden md:table-cell">Удалено</TableHead>
                  <TableHead className="w-24 text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id} className="bg-destructive/5">
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(product.id)}
                        onCheckedChange={() => toggleSelect(product.id)}
                      />
                    </TableCell>
                    <TableCell>
                      {product.images && product.images.length > 0 ? (
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-10 h-10 object-cover rounded opacity-60"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-muted rounded flex items-center justify-center opacity-60">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground line-through">{product.name}</span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {product.price.toLocaleString("ru-RU")} ₽
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                      {formatDeletedAt(product.deleted_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => restoreProduct(product.id)}
                          title="Восстановить"
                        >
                          <RotateCcw className="h-4 w-4 text-green-600" />
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" title="Удалить навсегда">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Удалить навсегда?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Товар "{product.name}" будет удалён безвозвратно.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Отмена</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => permanentlyDeleteProduct(product.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Удалить
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
