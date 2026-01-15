import React, { useMemo } from "react";
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
import { FileSpreadsheet, ArrowRight, Check, AlertTriangle } from "lucide-react";

export interface ExcelColumnInfo {
  index: number;
  header: string;
  sampleValues: string[];
}

export interface ColumnMapping {
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

export function ExcelColumnMapping({
  columns,
  mapping,
  onMappingChange,
  onConfirm,
  onCancel,
  fileName,
  rowCount,
}: ExcelColumnMappingProps) {
  const isValid = mapping.nameColumn !== null && mapping.priceColumn !== null;
  
  const nameColumn = useMemo(() => 
    columns.find(c => c.index === mapping.nameColumn),
    [columns, mapping.nameColumn]
  );
  
  const priceColumn = useMemo(() => 
    columns.find(c => c.index === mapping.priceColumn),
    [columns, mapping.priceColumn]
  );

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

      {/* Column mapping */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="px-6 py-4">
          <p className="text-sm font-medium mb-1">Сопоставьте колонки</p>
          <p className="text-xs text-muted-foreground mb-4">
            Укажите какая колонка содержит название товара и цену
          </p>

          <div className="space-y-4">
            {/* Name column mapping */}
            <div className="space-y-2">
              <label className="text-xs font-medium flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">Название</Badge>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">колонка в файле</span>
              </label>
              <Select
                value={mapping.nameColumn?.toString() ?? ""}
                onValueChange={(val) => onMappingChange({ ...mapping, nameColumn: val ? parseInt(val) : null })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выберите колонку с названием" />
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

            {/* Price column mapping */}
            <div className="space-y-2">
              <label className="text-xs font-medium flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">Себестоимость</Badge>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">колонка в файле</span>
              </label>
              <Select
                value={mapping.priceColumn?.toString() ?? ""}
                onValueChange={(val) => onMappingChange({ ...mapping, priceColumn: val ? parseInt(val) : null })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выберите колонку с ценой" />
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

        {/* Preview of selected columns */}
        {(nameColumn || priceColumn) && (
          <div className="px-6 py-3 border-t bg-muted/30">
            <p className="text-xs font-medium mb-2 flex items-center gap-2">
              <Check className="h-3 w-3 text-emerald-600" />
              Предпросмотр данных
            </p>
            <ScrollArea className="h-[150px]">
              <div className="space-y-1.5">
                {[0, 1, 2, 3, 4].map((i) => {
                  const nameVal = nameColumn?.sampleValues[i];
                  const priceVal = priceColumn?.sampleValues[i];
                  if (!nameVal && !priceVal) return null;
                  
                  return (
                    <div 
                      key={i} 
                      className="flex items-center gap-2 text-xs bg-background rounded px-2 py-1.5 border"
                    >
                      <span className="flex-1 truncate font-medium">
                        {nameVal || '—'}
                      </span>
                      <span className="text-muted-foreground shrink-0">
                        {priceVal ? `${priceVal} ₽` : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Warning if same column selected */}
        {mapping.nameColumn !== null && mapping.priceColumn !== null && mapping.nameColumn === mapping.priceColumn && (
          <div className="px-6 py-2 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-200 dark:border-amber-800">
            <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <AlertTriangle className="h-3 w-3" />
              Название и цена не могут быть в одной колонке
            </p>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="px-6 py-4 border-t flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          Отмена
        </Button>
        <Button 
          className="flex-1" 
          onClick={onConfirm}
          disabled={!isValid || mapping.nameColumn === mapping.priceColumn}
        >
          <Check className="h-4 w-4 mr-1" />
          Импортировать
        </Button>
      </div>
    </div>
  );
}
