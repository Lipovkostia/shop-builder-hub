import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { FileSpreadsheet, ArrowRight, Check, AlertTriangle, Search, Edit3 } from "lucide-react";

export interface ExcelColumnInfo {
  index: number;
  header: string;
  sampleValues: string[];
}

// Extended mapping for flexible import
export interface ColumnMapping {
  // Step 1: How to identify the product
  identifierType: 'sku' | 'name';
  identifierColumn: number | null;
  
  // Step 2: Which fields to update (column index or null if not updating)
  fieldsToUpdate: {
    buyPrice: number | null;
    price: number | null;
    unit: number | null;
    name: number | null;
    description: number | null;
    group: number | null;
    volume: number | null;
    photos: number | null;
  };
}

// Legacy interface for backward compatibility
export interface LegacyColumnMapping {
  nameColumn: number | null;
  priceColumn: number | null;
}

// Import options for full import mode
export interface ImportOptions {
  createNewProducts: boolean;
  hideNotInFile: boolean;
}

interface ExcelColumnMappingProps {
  columns: ExcelColumnInfo[];
  mapping: ColumnMapping;
  onMappingChange: (mapping: ColumnMapping) => void;
  onConfirm: () => void;
  onCancel: () => void;
  fileName: string;
  rowCount: number;
  // Extended mode props (for assortment import)
  mode?: 'price-list' | 'assortment';
  importOptions?: ImportOptions;
  onImportOptionsChange?: (options: ImportOptions) => void;
}

// Base update fields (shown in price-list mode)
const baseUpdateFields = [
  { key: 'buyPrice', label: 'Себестоимость', description: 'Закупочная цена товара' },
  { key: 'price', label: 'Цена', description: 'Отпускная цена товара' },
  { key: 'unit', label: 'Единица измерения', description: 'кг, шт, л и т.д.' },
  { key: 'name', label: 'Название', description: 'Обновить название товара' },
  { key: 'photos', label: 'Фото', description: 'Ссылки на изображения через , или ;' },
] as const;

// Additional fields for assortment mode
const assortmentFields = [
  { key: 'buyPrice', label: 'Себестоимость', description: 'Закупочная цена товара' },
  { key: 'price', label: 'Цена', description: 'Отпускная цена товара' },
  { key: 'unit', label: 'Единица измерения', description: 'кг, шт, л и т.д.' },
  { key: 'name', label: 'Название', description: 'Обновить название товара' },
  { key: 'description', label: 'Описание', description: 'Описание товара' },
  { key: 'group', label: 'Группа', description: 'Группа товара' },
  { key: 'volume', label: 'Объём', description: 'Вес или количество в упаковке' },
  { key: 'photos', label: 'Фото', description: 'Ссылки на изображения через ;' },
] as const;

export function ExcelColumnMapping({
  columns,
  mapping,
  onMappingChange,
  onConfirm,
  onCancel,
  fileName,
  rowCount,
  mode = 'price-list',
  importOptions,
  onImportOptionsChange,
}: ExcelColumnMappingProps) {
  // Get the appropriate field list based on mode
  const updateFields = mode === 'assortment' ? assortmentFields : baseUpdateFields;
  
  // Track which update fields are enabled
  const [enabledFields, setEnabledFields] = useState<Record<string, boolean>>({
    buyPrice: mapping.fieldsToUpdate.buyPrice !== null,
    price: mapping.fieldsToUpdate.price !== null,
    unit: mapping.fieldsToUpdate.unit !== null,
    name: mapping.fieldsToUpdate.name !== null,
    description: mapping.fieldsToUpdate.description !== null,
    group: mapping.fieldsToUpdate.group !== null,
    volume: mapping.fieldsToUpdate.volume !== null,
    photos: mapping.fieldsToUpdate.photos !== null,
  });

  // Validation: identifier must be selected and at least one update field
  const isValid = useMemo(() => {
    if (mapping.identifierColumn === null) return false;
    
    const hasAtLeastOneField = Object.entries(enabledFields).some(
      ([key, enabled]) => enabled && mapping.fieldsToUpdate[key as keyof typeof mapping.fieldsToUpdate] !== null
    );
    
    return hasAtLeastOneField;
  }, [mapping, enabledFields]);

  // Find selected identifier column for preview
  const identifierColumn = useMemo(() => 
    columns.find(c => c.index === mapping.identifierColumn),
    [columns, mapping.identifierColumn]
  );

  // Find selected update columns for preview
  const selectedUpdateColumns = useMemo(() => {
    const result: Array<{ key: string; label: string; column: ExcelColumnInfo }> = [];
    
    for (const field of updateFields) {
      const columnIdx = mapping.fieldsToUpdate[field.key];
      if (columnIdx !== null && enabledFields[field.key]) {
        const col = columns.find(c => c.index === columnIdx);
        if (col) {
          result.push({ key: field.key, label: field.label, column: col });
        }
      }
    }
    
    return result;
  }, [columns, mapping.fieldsToUpdate, enabledFields]);

  // Handle identifier type change
  const handleIdentifierTypeChange = (type: 'sku' | 'name') => {
    onMappingChange({
      ...mapping,
      identifierType: type,
      identifierColumn: null, // Reset column when type changes
      // If switching to name identification, disable name update
      fieldsToUpdate: type === 'name' 
        ? { ...mapping.fieldsToUpdate, name: null }
        : mapping.fieldsToUpdate
    });
    
    if (type === 'name') {
      setEnabledFields(prev => ({ ...prev, name: false }));
    }
  };

  // Handle identifier column change
  const handleIdentifierColumnChange = (value: string) => {
    onMappingChange({
      ...mapping,
      identifierColumn: value ? parseInt(value) : null,
    });
  };

  // Handle field toggle
  const handleFieldToggle = (fieldKey: string, enabled: boolean) => {
    setEnabledFields(prev => ({ ...prev, [fieldKey]: enabled }));
    
    if (!enabled) {
      onMappingChange({
        ...mapping,
        fieldsToUpdate: {
          ...mapping.fieldsToUpdate,
          [fieldKey]: null,
        },
      });
    }
  };

  // Handle field column change
  const handleFieldColumnChange = (fieldKey: string, value: string) => {
    onMappingChange({
      ...mapping,
      fieldsToUpdate: {
        ...mapping.fieldsToUpdate,
        [fieldKey]: value ? parseInt(value) : null,
      },
    });
  };

  // Check for duplicate column usage
  const hasDuplicateColumns = useMemo(() => {
    const usedColumns = new Set<number>();
    
    if (mapping.identifierColumn !== null) {
      usedColumns.add(mapping.identifierColumn);
    }
    
    for (const [key, colIdx] of Object.entries(mapping.fieldsToUpdate)) {
      if (colIdx !== null && enabledFields[key]) {
        if (usedColumns.has(colIdx)) {
          return true;
        }
        usedColumns.add(colIdx);
      }
    }
    
    return false;
  }, [mapping, enabledFields]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-2 border-b bg-gradient-to-r from-blue-500/5 to-indigo-500/5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center">
            <FileSpreadsheet className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{fileName}</p>
            <p className="text-xs text-muted-foreground">
              {rowCount} строк · {columns.length} колонок
            </p>
          </div>
        </div>
      </div>

      {/* Column mapping content */}
      <ScrollArea className="flex-1">
        <div className="px-4 py-2 space-y-3">
          
          {/* Step 1: How to identify the product */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                <Search className="h-3 w-3 text-primary" />
              </div>
              <p className="text-sm font-medium">Как найти товар в системе?</p>
            </div>
            
            <div className="pl-6 space-y-2">
              <RadioGroup 
                value={mapping.identifierType} 
                onValueChange={(v) => handleIdentifierTypeChange(v as 'sku' | 'name')}
                className="space-y-1"
              >
                <div className="flex items-center space-x-2 p-1.5 rounded-md border bg-card hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="sku" id="id-sku" />
                  <Label htmlFor="id-sku" className="flex-1 cursor-pointer text-sm">
                    <span className="font-medium">Код товара (SKU)</span>
                    <span className="text-[11px] text-muted-foreground ml-1">— артикул</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-1.5 rounded-md border bg-card hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="name" id="id-name" />
                  <Label htmlFor="id-name" className="flex-1 cursor-pointer text-sm">
                    <span className="font-medium">Название</span>
                    <span className="text-[11px] text-muted-foreground ml-1">— полное совпадение</span>
                  </Label>
                </div>
              </RadioGroup>

              {/* Identifier column selector */}
              <div className="space-y-1">
                <label className="text-xs flex items-center gap-1.5">
                  <Badge variant="secondary" className="text-[10px] py-0">
                    {mapping.identifierType === 'sku' ? 'Код' : 'Название'}
                  </Badge>
                  <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                  <span className="text-muted-foreground">колонка</span>
                </label>
                <Select
                  value={mapping.identifierColumn?.toString() ?? ""}
                  onValueChange={handleIdentifierColumnChange}
                >
                  <SelectTrigger className="w-full h-8 text-sm">
                    <SelectValue placeholder={`Выберите колонку`} />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((col) => (
                      <SelectItem key={col.index} value={col.index.toString()}>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-xs">#{col.index + 1}</span>
                          <span className="truncate max-w-[200px]">{col.header || `Колонка ${col.index + 1}`}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t" />

          {/* Step 2: Which data to update */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Edit3 className="h-3 w-3 text-emerald-600" />
              </div>
              <p className="text-sm font-medium">Какие данные обновить?</p>
            </div>
            
            <div className="pl-6 space-y-1.5">
              {updateFields.map((field) => {
                // Don't show name update if identifying by name
                if (field.key === 'name' && mapping.identifierType === 'name') {
                  return null;
                }
                
                const isEnabled = enabledFields[field.key];
                const columnValue = mapping.fieldsToUpdate[field.key];
                
                return (
                  <div key={field.key} className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id={`field-${field.key}`}
                        checked={isEnabled}
                        onCheckedChange={(checked) => handleFieldToggle(field.key, !!checked)}
                        className="h-4 w-4"
                      />
                      <Label htmlFor={`field-${field.key}`} className="cursor-pointer text-sm flex items-center gap-1.5">
                        <span className="font-medium">{field.label}</span>
                        <span className="text-[11px] text-muted-foreground">— {field.description}</span>
                      </Label>
                    </div>
                    
                    {isEnabled && (
                      <div className="ml-6">
                        <Select
                          value={columnValue?.toString() ?? ""}
                          onValueChange={(v) => handleFieldColumnChange(field.key, v)}
                        >
                          <SelectTrigger className="w-full h-8 text-sm">
                            <SelectValue placeholder="Выберите колонку" />
                          </SelectTrigger>
                          <SelectContent>
                            {columns.map((col) => (
                              <SelectItem key={col.index} value={col.index.toString()}>
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground text-xs">#{col.index + 1}</span>
                                  <span className="truncate max-w-[200px]">{col.header || `Колонка ${col.index + 1}`}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {/* Import options for assortment mode */}
          {mode === 'assortment' && importOptions && onImportOptionsChange && (
            <>
              <div className="border-t" />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <AlertTriangle className="h-3 w-3 text-amber-600" />
                  </div>
                  <p className="text-sm font-medium">Дополнительные действия</p>
                </div>
                
                <div className="pl-6 space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="create-new"
                      checked={importOptions.createNewProducts}
                      onCheckedChange={(checked) => onImportOptionsChange({
                        ...importOptions,
                        createNewProducts: !!checked
                      })}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="create-new" className="cursor-pointer text-sm flex items-center gap-1.5">
                      <span className="font-medium">Создать новые товары</span>
                      <span className="text-[11px] text-muted-foreground">— если не найден</span>
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="hide-missing"
                      checked={importOptions.hideNotInFile}
                      onCheckedChange={(checked) => onImportOptionsChange({
                        ...importOptions,
                        hideNotInFile: !!checked
                      })}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="hide-missing" className="cursor-pointer text-sm flex items-center gap-1.5">
                      <span className="font-medium">Скрыть отсутствующие</span>
                      <span className="text-[11px] text-muted-foreground">— деактивировать</span>
                    </Label>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>

      {/* Preview of selected columns */}
      {identifierColumn && selectedUpdateColumns.length > 0 && (
        <div className="px-4 py-2 border-t bg-muted/30">
          <p className="text-[11px] font-medium mb-1 flex items-center gap-1.5">
            <Check className="h-3 w-3 text-emerald-600" />
            Предпросмотр
          </p>
          <ScrollArea className="h-[60px]">
            <div className="space-y-1">
              {[0, 1, 2].map((i) => {
                const idVal = identifierColumn?.sampleValues[i];
                if (!idVal) return null;
                
                return (
                  <div 
                    key={i} 
                    className="flex items-center gap-1.5 text-[11px] bg-background rounded px-1.5 py-1 border"
                  >
                    <span className="font-medium text-primary shrink-0 max-w-[80px] truncate">
                      {idVal}
                    </span>
                    <ArrowRight className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 flex items-center gap-1 overflow-hidden">
                      {selectedUpdateColumns.map(({ key, label, column }) => (
                        <Badge key={key} variant="outline" className="text-[9px] font-normal py-0">
                          {label}: {column.sampleValues[i] || '—'}
                        </Badge>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Warning if same column selected multiple times */}
      {hasDuplicateColumns && (
        <div className="px-4 py-1.5 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-200 dark:border-amber-800">
          <p className="text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3" />
            Одна колонка используется несколько раз
          </p>
        </div>
      )}

      {/* Footer actions */}
      <div className="px-4 py-2 border-t flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onCancel}>
          Отмена
        </Button>
        <Button 
          size="sm"
          className="flex-1" 
          onClick={onConfirm}
          disabled={!isValid || hasDuplicateColumns}
        >
          <Check className="h-3.5 w-3.5 mr-1" />
          Импортировать
        </Button>
      </div>
    </div>
  );
}
