import * as React from "react";
import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

/**
 * Resizable Table - extends standard table styling with column resize functionality
 * Inherits all standardized table styles (fixed heights, no wrap, alignment, truncation)
 */

interface ColumnConfig {
  id: string;
  minWidth: number;
  defaultWidth: number;
}

interface ResizableTableContextValue {
  columnWidths: Record<string, number>;
  setColumnWidth: (id: string, width: number) => void;
}

const ResizableTableContext = React.createContext<ResizableTableContextValue | null>(null);

interface ResizableTableProps extends React.HTMLAttributes<HTMLTableElement> {
  columns: ColumnConfig[];
  storageKey?: string;
}

export function ResizableTable({ 
  columns, 
  storageKey,
  className, 
  children,
  ...props 
}: ResizableTableProps) {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    if (storageKey) {
      const saved = localStorage.getItem(`table-widths-${storageKey}`);
      if (saved) {
        try {
          return JSON.parse(saved);
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
      const newWidths = { ...prev, [id]: width };
      if (storageKey) {
        localStorage.setItem(`table-widths-${storageKey}`, JSON.stringify(newWidths));
      }
      return newWidths;
    });
  }, [storageKey]);

  return (
    <ResizableTableContext.Provider value={{ columnWidths, setColumnWidth }}>
      <div className="relative w-full overflow-x-auto scrollbar-thin">
        <table 
          className={cn(
            "w-max min-w-full caption-bottom text-xs border-collapse",
            className
          )} 
          {...props}
        >
          {children}
        </table>
      </div>
    </ResizableTableContext.Provider>
  );
}

export function ResizableTableHeader({ 
  className, 
  children,
  ...props 
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead 
      className={cn(
        "[&_tr]:border-b bg-muted/30 sticky top-0 z-10",
        className
      )} 
      {...props}
    >
      {children}
    </thead>
  );
}

export function ResizableTableBody({ 
  className, 
  ...props 
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  );
}

export function ResizableTableRow({ 
  className, 
  ...props 
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b transition-colors data-[state=selected]:bg-muted hover:bg-muted/50",
        "h-11", // Fixed row height - matches standard Table
        className
      )}
      {...props}
    />
  );
}

interface ResizableTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  columnId: string;
  minWidth?: number;
  resizable?: boolean;
}

export function ResizableTableHead({ 
  columnId,
  minWidth = 50,
  resizable = true,
  className, 
  children,
  style,
  ...props 
}: ResizableTableHeadProps) {
  const context = React.useContext(ResizableTableContext);
  const [isResizing, setIsResizing] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const width = context?.columnWidths[columnId] ?? minWidth;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startX.current = e.clientX;
    startWidth.current = width;
  }, [width]);

  React.useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX.current;
      const newWidth = Math.max(minWidth, startWidth.current + diff);
      context?.setColumnWidth(columnId, newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, columnId, minWidth, context]);

  return (
    <th
      className={cn(
        "h-10 px-3 text-left align-middle font-medium text-muted-foreground",
        "whitespace-nowrap overflow-hidden relative select-none", // No text wrap
        className
      )}
      style={{ ...style, width: `${width}px`, minWidth: `${minWidth}px`, maxWidth: `${width}px` }}
      {...props}
    >
      <div className="truncate pr-2">{children}</div>
      {resizable && (
        <div
          className={cn(
            "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors",
            isResizing && "bg-primary"
          )}
          onMouseDown={handleMouseDown}
        />
      )}
    </th>
  );
}

interface ResizableTableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  columnId: string;
}

export function ResizableTableCell({ 
  columnId,
  className, 
  children,
  style,
  ...props 
}: ResizableTableCellProps) {
  const context = React.useContext(ResizableTableContext);
  const width = context?.columnWidths[columnId];

  return (
    <td 
      className={cn(
        "px-3 py-2 align-middle",
        "whitespace-nowrap overflow-hidden", // No text wrap - matches standard Table
        className
      )} 
      style={{ ...style, width: width ? `${width}px` : undefined, maxWidth: width ? `${width}px` : undefined }}
      {...props}
    >
      <div className="truncate">{children}</div>
    </td>
  );
}

// Export context for external use if needed
export { ResizableTableContext };
