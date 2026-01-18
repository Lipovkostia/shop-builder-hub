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
    unit: number | null;
    name: number | null;
  };
}

// Legacy interface for backward compatibility
export interface LegacyColumnMapping {
  nameColumn: number | null;
  priceColumn: number | null;
}

interface ExcelColumnMappingProps {
  columns: ExcelColumnInfo[];
  mapping: ColumnMapping;
  onMappingChange: (mapping: ColumnMapping) => void;
  onConfirm: () => void;
  onCancel: () => void;
  fileName: string;
  rowCount: number;
}

// Field definitions for "what to update"
const updateFields = [
  { key: 'buyPrice', label: 'Себестоимость', description: 'Закупочная цена товара' },
  { key: 'unit', label: 'Единица измерения', description: 'кг, шт, л и т.д.' },
  { key: 'name', label: 'Название', description: 'Обновить название товара' },
] as const;

export function ExcelColumnMapping({
  columns,
  mapping,
  onMappingChange,
  onConfirm,
  onCancel,
  fileName,
  rowCount,
}: ExcelColumnMappingProps) {
  // Track which update fields are enabled
  const [enabledFields, setEnabledFields] = useState<Record<string, boolean>>({
    buyPrice: mapping.fieldsToUpdate.buyPrice !== null,
    unit: mapping.fieldsToUpdate.unit !== null,
    name: mapping.fieldsToUpdate.name !== null,
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
      <div className="px-6 py-4 border-b bg-gradient-to-r from-blue-500/10 to-indigo-500/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
            <FileSpreadsheet className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{fileName}</p>
            <p className="text-xs text-muted-foreground">
              Найдено {rowCount} строк · {columns.length} колонок
            </p>
          </div>
        </div>
      </div>

      {/* Column mapping content */}
      <ScrollArea className="flex-1">
        <div className="px-6 py-4 space-y-6">
          
          {/* Step 1: How to identify the product */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                <Search className="h-3.5 w-3.5 text-primary" />
              </div>
              <p className="text-sm font-medium">Как найти товар в системе?</p>
            </div>
            
            <div className="pl-8 space-y-3">
              <RadioGroup 
                value={mapping.identifierType} 
                onValueChange={(v) => handleIdentifierTypeChange(v as 'sku' | 'name')}
                className="space-y-2"
              >
                <div className="flex items-center space-x-3 p-2.5 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="sku" id="id-sku" />
                  <Label htmlFor="id-sku" className="flex-1 cursor-pointer">
                    <span className="font-medium">Код товара (SKU)</span>
                    <span className="text-xs text-muted-foreground block">Артикул или уникальный код</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-2.5 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="name" id="id-name" />
                  <Label htmlFor="id-name" className="flex-1 cursor-pointer">
                    <span className="font-medium">Название</span>
                    <span className="text-xs text-muted-foreground block">Полное совпадение названия</span>
                  </Label>
                </div>
              </RadioGroup>

              {/* Identifier column selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {mapping.identifierType === 'sku' ? 'Код товара' : 'Название'}
                  </Badge>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">колонка в файле</span>
                </label>
                <Select
                  value={mapping.identifierColumn?.toString() ?? ""}
                  onValueChange={handleIdentifierColumnChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={`Выберите колонку с ${mapping.identifierType === 'sku' ? 'кодом товара' : 'названием'}`} />
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
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Edit3 className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <p className="text-sm font-medium">Какие данные обновить?</p>
            </div>
            
            <div className="pl-8 space-y-3">
              {updateFields.map((field) => {
                // Don't show name update if identifying by name
                if (field.key === 'name' && mapping.identifierType === 'name') {
                  return null;
                }
                
                const isEnabled = enabledFields[field.key];
                const columnValue = mapping.fieldsToUpdate[field.key];
                
                return (
                  <div key={field.key} className="space-y-2">
                    <div className="flex items-center space-x-3">
                      <Checkbox 
                        id={`field-${field.key}`}
                        checked={isEnabled}
                        onCheckedChange={(checked) => handleFieldToggle(field.key, !!checked)}
                      />
                      <Label htmlFor={`field-${field.key}`} className="cursor-pointer">
                        <span className="font-medium">{field.label}</span>
                        <span className="text-xs text-muted-foreground block">{field.description}</span>
                      </Label>
                    </div>
                    
                    {isEnabled && (
                      <div className="ml-7">
                        <Select
                          value={columnValue?.toString() ?? ""}
                          onValueChange={(v) => handleFieldColumnChange(field.key, v)}
                        >
                          <SelectTrigger className="w-full">
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
        </div>
      </ScrollArea>

      {/* Preview of selected columns */}
      {identifierColumn && selectedUpdateColumns.length > 0 && (
        <div className="px-6 py-3 border-t bg-muted/30">
          <p className="text-xs font-medium mb-2 flex items-center gap-2">
            <Check className="h-3 w-3 text-emerald-600" />
            Предпросмотр данных
          </p>
          <ScrollArea className="h-[120px]">
            <div className="space-y-1.5">
              {[0, 1, 2, 3].map((i) => {
                const idVal = identifierColumn?.sampleValues[i];
                if (!idVal) return null;
                
                return (
                  <div 
                    key={i} 
                    className="flex items-center gap-2 text-xs bg-background rounded px-2 py-1.5 border"
                  >
                    <span className="font-medium text-primary shrink-0 max-w-[100px] truncate">
                      {idVal}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <div className="flex-1 flex items-center gap-2 overflow-hidden">
                      {selectedUpdateColumns.map(({ key, label, column }) => (
                        <span key={key} className="text-muted-foreground shrink-0">
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {label}: {column.sampleValues[i] || '—'}
                          </Badge>
                        </span>
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
        <div className="px-6 py-2 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
            <AlertTriangle className="h-3 w-3" />
            Одна колонка используется несколько раз
          </p>
        </div>
      )}

      {/* Footer actions */}
      <div className="px-6 py-4 border-t flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          Отмена
        </Button>
        <Button 
          className="flex-1" 
          onClick={onConfirm}
          disabled={!isValid || hasDuplicateColumns}
        >
          <Check className="h-4 w-4 mr-1" />
          Импортировать
        </Button>
      </div>
    </div>
  );
}
