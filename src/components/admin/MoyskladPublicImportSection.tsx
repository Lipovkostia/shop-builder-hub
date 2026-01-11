import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  ArrowLeft, 
  Globe, 
  Loader2, 
  Check, 
  AlertCircle,
  Search,
  Package
} from 'lucide-react';
import { useMoyskladPublicCatalog, PublicCatalogProduct } from '@/hooks/useMoyskladPublicCatalog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface MoyskladPublicImportSectionProps {
  storeId: string;
  onBack: () => void;
  onComplete: () => void;
}

interface ImportProgress {
  total: number;
  current: number;
  currentProduct: string;
  status: 'importing' | 'uploading_images' | 'done' | 'error';
  successCount: number;
  errors: string[];
}

export function MoyskladPublicImportSection({ 
  storeId, 
  onBack, 
  onComplete 
}: MoyskladPublicImportSectionProps) {
  const [catalogUrl, setCatalogUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();
  
  const {
    products,
    loading,
    error,
    totalCount,
    fetchCatalog,
    toggleProductSelection,
    selectAll,
    deselectAll,
    getSelectedProducts,
    reset,
  } = useMoyskladPublicCatalog();

  const handleFetchCatalog = async () => {
    if (!catalogUrl.trim()) {
      toast({
        title: 'Введите ссылку',
        description: 'Укажите ссылку на публичный каталог МойСклад',
        variant: 'destructive',
      });
      return;
    }

    await fetchCatalog(catalogUrl);
  };

  const generateSlug = (name: string): string => {
    const translitMap: { [key: string]: string } = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
      'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
      'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
      'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '',
      'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    };

    return name
      .toLowerCase()
      .split('')
      .map(char => translitMap[char] || char)
      .join('')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 100);
  };

  const handleImport = async () => {
    const selectedProducts = getSelectedProducts();
    if (selectedProducts.length === 0) {
      toast({
        title: 'Выберите товары',
        description: 'Отметьте товары для импорта',
        variant: 'destructive',
      });
      return;
    }

    setIsImporting(true);
    setImportProgress({
      total: selectedProducts.length,
      current: 0,
      currentProduct: '',
      status: 'importing',
      successCount: 0,
      errors: [],
    });

    const errors: string[] = [];
    let successCount = 0;

    for (let i = 0; i < selectedProducts.length; i++) {
      const product = selectedProducts[i];
      
      setImportProgress(prev => prev ? {
        ...prev,
        current: i + 1,
        currentProduct: product.name,
        status: 'importing',
      } : null);

      try {
        const baseSlug = generateSlug(product.name);
        const timestamp = Date.now();
        const slug = `${baseSlug}-${timestamp}`;

        // Create product
        const { data: newProduct, error: insertError } = await supabase
          .from('products')
          .insert({
            store_id: storeId,
            name: product.name,
            slug,
            sku: product.code || null,
            price: product.price,
            buy_price: product.price,
            unit: product.unit,
            quantity: 0,
            is_active: true,
            source: 'moysklad_public',
          })
          .select()
          .single();

        if (insertError) {
          throw new Error(insertError.message);
        }

        // Create product group if category exists
        if (product.category && newProduct) {
          // Check if group exists
          const { data: existingGroup } = await supabase
            .from('product_groups')
            .select('id')
            .eq('store_id', storeId)
            .eq('name', product.category)
            .single();

          let groupId = existingGroup?.id;

          if (!groupId) {
            // Create new group
            const { data: newGroup } = await supabase
              .from('product_groups')
              .insert({
                store_id: storeId,
                name: product.category,
              })
              .select('id')
              .single();

            groupId = newGroup?.id;
          }

          // Assign product to group
          if (groupId) {
            await supabase
              .from('product_group_assignments')
              .insert({
                product_id: newProduct.id,
                group_id: groupId,
              });
          }
        }

        // Upload thumbnail if available
        if (product.thumbnailUrl && newProduct) {
          setImportProgress(prev => prev ? {
            ...prev,
            status: 'uploading_images',
          } : null);

          try {
            const { data: imageData } = await supabase.functions.invoke('fetch-external-image', {
              body: {
                imageUrl: product.thumbnailUrl,
                productId: newProduct.id,
                imageIndex: 0,
              }
            });

            if (imageData?.publicUrl) {
              await supabase
                .from('products')
                .update({ images: [imageData.publicUrl] })
                .eq('id', newProduct.id);
            }
          } catch (imgError) {
            console.warn(`Failed to upload image for ${product.name}:`, imgError);
          }
        }

        successCount++;
      } catch (err: any) {
        console.error(`Error importing ${product.name}:`, err);
        errors.push(`${product.name}: ${err.message}`);
      }
    }

    setImportProgress({
      total: selectedProducts.length,
      current: selectedProducts.length,
      currentProduct: '',
      status: errors.length > 0 && successCount === 0 ? 'error' : 'done',
      successCount,
      errors,
    });

    setIsImporting(false);

    if (successCount > 0) {
      onComplete();
    }
  };

  const getProgressPercent = () => {
    if (!importProgress || importProgress.total === 0) return 0;
    return Math.round((importProgress.current / importProgress.total) * 100);
  };

  const filteredProducts = products.filter(p => 
    !searchQuery || 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedCount = products.filter(p => p.selected).length;

  const handleReset = () => {
    reset();
    setCatalogUrl('');
    setImportProgress(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack} disabled={isImporting}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Назад
        </Button>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Публичный каталог МойСклад</h2>
          <p className="text-sm text-muted-foreground">Импорт товаров по публичной ссылке</p>
        </div>
      </div>

      {/* URL Input */}
      {products.length === 0 && !importProgress && (
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-start gap-4">
              <Globe className="h-8 w-8 text-primary flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-medium mb-1">Как это работает</h4>
                <p className="text-sm text-muted-foreground">
                  Вставьте ссылку на публичный каталог вида <code className="bg-muted px-1 py-0.5 rounded text-xs">https://b2b.moysklad.ru/public/XXXXX/catalog</code>. 
                  Мы загрузим все доступные товары с названием, артикулом, ценой и фото.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="https://b2b.moysklad.ru/public/..."
              value={catalogUrl}
              onChange={(e) => setCatalogUrl(e.target.value)}
              disabled={loading}
              className="flex-1"
            />
            <Button onClick={handleFetchCatalog} disabled={loading || !catalogUrl.trim()}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Загрузить
            </Button>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Products list */}
      {products.length > 0 && !importProgress && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">Найдено товаров: {totalCount}</span>
              <span className="text-muted-foreground">
                (выбрано: {selectedCount})
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>
                Выбрать все
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>
                Снять выбор
              </Button>
            </div>
          </div>

          <Input
            placeholder="Поиск по названию или артикулу..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="border rounded-lg max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="p-2 text-left w-10"></th>
                  <th className="p-2 text-left w-16">Фото</th>
                  <th className="p-2 text-left">Название</th>
                  <th className="p-2 text-left">Артикул</th>
                  <th className="p-2 text-right">Цена</th>
                  <th className="p-2 text-left">Ед.</th>
                  <th className="p-2 text-left">Группа</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr 
                    key={product.id} 
                    className={cn(
                      "border-t hover:bg-muted/30 cursor-pointer",
                      product.selected && "bg-primary/5"
                    )}
                    onClick={() => toggleProductSelection(product.id)}
                  >
                    <td className="p-2">
                      <Checkbox 
                        checked={product.selected} 
                        onCheckedChange={() => toggleProductSelection(product.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="p-2">
                      {product.thumbnailUrl ? (
                        <img 
                          src={product.thumbnailUrl} 
                          alt="" 
                          className="w-10 h-10 object-cover rounded"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </td>
                    <td className="p-2 font-medium">{product.name}</td>
                    <td className="p-2 text-muted-foreground">{product.code || '—'}</td>
                    <td className="p-2 text-right">{product.price.toLocaleString('ru-RU')} ₽</td>
                    <td className="p-2 text-muted-foreground">{product.unit}</td>
                    <td className="p-2 text-muted-foreground">{product.category || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset} disabled={isImporting}>
              Отмена
            </Button>
            <Button onClick={handleImport} disabled={isImporting || selectedCount === 0}>
              {isImporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Импортировать {selectedCount} {selectedCount === 1 ? 'товар' : 
                selectedCount < 5 ? 'товара' : 'товаров'}
            </Button>
          </div>
        </div>
      )}

      {/* Import Progress */}
      {importProgress && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-3">
            {importProgress.status === 'done' && importProgress.successCount > 0 && (
              <Check className="h-5 w-5 text-green-500" />
            )}
            {importProgress.status === 'error' && (
              <AlertCircle className="h-5 w-5 text-destructive" />
            )}
            {(importProgress.status === 'importing' || importProgress.status === 'uploading_images') && (
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
            )}
            <span className="font-medium">
              {importProgress.status === 'done' 
                ? `Импортировано: ${importProgress.successCount}` 
                : importProgress.status === 'error'
                ? 'Ошибка импорта'
                : importProgress.status === 'uploading_images'
                ? `Загрузка фото: ${importProgress.currentProduct}`
                : `Импорт ${importProgress.current} из ${importProgress.total}`}
            </span>
          </div>

          {(importProgress.status === 'importing' || importProgress.status === 'uploading_images') && (
            <div className="space-y-2">
              <Progress value={getProgressPercent()} />
              <p className="text-sm text-muted-foreground">{importProgress.currentProduct}</p>
            </div>
          )}

          {importProgress.errors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 max-h-40 overflow-y-auto">
              <p className="text-sm font-medium text-destructive mb-2">
                Ошибки ({importProgress.errors.length}):
              </p>
              <ul className="text-sm text-destructive/80 space-y-1">
                {importProgress.errors.map((err, i) => (
                  <li key={i}>• {err}</li>
                ))}
              </ul>
            </div>
          )}

          {importProgress.status === 'done' && importProgress.successCount > 0 && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
              <p className="text-sm text-green-700 dark:text-green-400">
                Успешно импортировано товаров: {importProgress.successCount}
              </p>
            </div>
          )}

          {(importProgress.status === 'done' || importProgress.status === 'error') && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleReset}>
                Загрузить ещё
              </Button>
              <Button size="sm" onClick={onBack}>
                Готово
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
