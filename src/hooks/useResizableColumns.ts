import { useState, useCallback, useEffect } from "react";

export interface ColumnConfig {
  id: string;
  minWidth: number;
  defaultWidth: number;
}

export function useResizableColumns(columns: ColumnConfig[], storageKey?: string) {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    if (storageKey) {
      const saved = localStorage.getItem(`table-widths-${storageKey}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // Merge saved widths with defaults for any new columns
          const merged = columns.reduce((acc, col) => {
            acc[col.id] = parsed[col.id] ?? col.defaultWidth;
            return acc;
          }, {} as Record<string, number>);
          return merged;
        } catch (e) {
          // ignore
        }
      }
    }
    return columns.reduce((acc, col) => {
      acc[col.id] = col.defaultWidth;
      return acc;
    }, {} as Record<string, number>);
  });

  const setColumnWidth = useCallback((id: string, width: number) => {
    setColumnWidths(prev => {
      const column = columns.find(c => c.id === id);
      const minWidth = column?.minWidth ?? 40;
      const newWidth = Math.max(minWidth, width);
      const newWidths = { ...prev, [id]: newWidth };
      
      if (storageKey) {
        localStorage.setItem(`table-widths-${storageKey}`, JSON.stringify(newWidths));
      }
      return newWidths;
    });
  }, [storageKey, columns]);

  const getColumnWidth = useCallback((id: string): number => {
    return columnWidths[id] ?? columns.find(c => c.id === id)?.defaultWidth ?? 100;
  }, [columnWidths, columns]);

  const getTotalWidth = useCallback((visibleColumns: Record<string, boolean | undefined>): number => {
    return columns.reduce((sum, col) => {
      if (visibleColumns[col.id] !== false) {
        return sum + (columnWidths[col.id] ?? col.defaultWidth);
      }
      return sum;
    }, 0);
  }, [columnWidths, columns]);

  const resetToDefaults = useCallback(() => {
    const defaults = columns.reduce((acc, col) => {
      acc[col.id] = col.defaultWidth;
      return acc;
    }, {} as Record<string, number>);
    setColumnWidths(defaults);
    
    if (storageKey) {
      localStorage.removeItem(`table-widths-${storageKey}`);
    }
  }, [columns, storageKey]);

  return {
    columnWidths,
    setColumnWidth,
    getColumnWidth,
    getTotalWidth,
    resetToDefaults,
  };
}
