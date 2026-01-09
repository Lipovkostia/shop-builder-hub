import * as React from "react";
import { useState, useRef, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

/**
 * Resizable Table - extends standard table styling with column resize and row drag-and-drop functionality
 */

interface ColumnConfig {
  id: string;
  minWidth: number;
  defaultWidth: number;
}

interface ResizableTableContextValue {
  columnWidths: Record<string, number>;
  setColumnWidth: (id: string, width: number) => void;
  columnOrder: string[];
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
  const [columnWidths, setColumnWidthsState] = useState<Record<string, number>>(() => {
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

  const columnOrder = useMemo(() => columns.map(c => c.id), [columns]);

  const setColumnWidth = useCallback((id: string, width: number) => {
    setColumnWidthsState(prev => {
      const newWidths = { ...prev, [id]: width };
      if (storageKey) {
        localStorage.setItem(`table-widths-${storageKey}`, JSON.stringify(newWidths));
      }
      return newWidths;
    });
  }, [storageKey]);

  const contextValue = useMemo(() => ({
    columnWidths,
    setColumnWidth,
    columnOrder,
  }), [columnWidths, setColumnWidth, columnOrder]);

  return (
    <ResizableTableContext.Provider value={contextValue}>
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

// Context for row drag and drop
interface RowDndContextValue {
  activeId: string | null;
}

const RowDndContext = React.createContext<RowDndContextValue | null>(null);

// Wrapper that provides DndContext at the table container level (outside table element)
interface DraggableTableWrapperProps {
  items: string[];
  onReorder?: (items: string[]) => void;
  children: React.ReactNode;
}

export function DraggableTableWrapper({
  items,
  onReorder,
  children,
}: DraggableTableWrapperProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 15,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 300,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = items.indexOf(active.id as string);
      const newIndex = items.indexOf(over.id as string);
      onReorder?.(arrayMove(items, oldIndex, newIndex));
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <RowDndContext.Provider value={{ activeId }}>
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          {children}
        </SortableContext>
      </RowDndContext.Provider>
      <DragOverlay dropAnimation={null}>
        {activeId ? (
          <div className="bg-card border shadow-lg rounded px-3 py-2 text-xs">
            Перемещение строки...
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// Sortable wrapper for rows - simplified version without DndContext
interface SortableTableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

export function SortableTableBody({ 
  className, 
  children,
  ...props 
}: SortableTableBodyProps) {
  return (
    <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props}>
      {children}
    </tbody>
  );
}

// Sortable row component
interface SortableTableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  id: string;
  disabled?: boolean;
}

export function SortableTableRow({ 
  id,
  disabled = false,
  className, 
  children,
  ...props 
}: SortableTableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-b transition-colors data-[state=selected]:bg-muted hover:bg-muted/50",
        "h-11",
        isDragging && "bg-muted/80 shadow-lg z-50",
        className
      )}
      {...props}
    >
      {!disabled && (
        <td className="w-8 px-1">
          <button
            type="button"
            className="p-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </td>
      )}
      {children}
    </tr>
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

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsResizing(true);
    startX.current = e.touches[0].clientX;
    startWidth.current = width;
  }, [width]);

  React.useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX.current;
      const newWidth = Math.max(minWidth, startWidth.current + diff);
      context?.setColumnWidth(columnId, newWidth);
    };

    const handleTouchMove = (e: TouchEvent) => {
      const diff = e.touches[0].clientX - startX.current;
      const newWidth = Math.max(minWidth, startWidth.current + diff);
      context?.setColumnWidth(columnId, newWidth);
    };

    const handleEnd = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isResizing, columnId, minWidth, context]);

  return (
    <th
      data-column-id={columnId}
      className={cn(
        "h-6 px-2 text-left align-middle font-medium text-muted-foreground text-xs",
        "whitespace-nowrap overflow-hidden relative select-none",
        className
      )}
      style={{ ...style, width: `${width}px`, minWidth: `${minWidth}px`, maxWidth: `${width}px` }}
      {...props}
    >
      <div className="truncate">{children}</div>
      {resizable && (
        <div
          className={cn(
            "absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/50 transition-colors touch-none",
            isResizing && "bg-primary"
          )}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
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
        "whitespace-nowrap overflow-hidden",
        className
      )} 
      style={{ ...style, width: width ? `${width}px` : undefined, maxWidth: width ? `${width}px` : undefined }}
      {...props}
    >
      <div className="truncate">{children}</div>
    </td>
  );
}

// Hook to get column order for rendering cells in correct order
export function useColumnOrder() {
  const context = React.useContext(ResizableTableContext);
  return context?.columnOrder ?? [];
}

// Component that renders children cells in the correct column order
interface OrderedCellsContainerProps {
  cells: Record<string, React.ReactNode>;
  fixedStart?: string[];
  fixedEnd?: string[];
  visibleColumns?: Record<string, boolean>;
}

export function OrderedCellsContainer({ cells, fixedStart = [], fixedEnd = [], visibleColumns }: OrderedCellsContainerProps) {
  const columnOrder = useColumnOrder();
  
  const reorderableColumns = columnOrder.filter(
    id => !fixedStart.includes(id) && !fixedEnd.includes(id)
  );
  
  const finalOrder = [...fixedStart, ...reorderableColumns, ...fixedEnd];
  
  // Filter by visibility if provided
  const visibleOrder = visibleColumns 
    ? finalOrder.filter(id => visibleColumns[id] !== false)
    : finalOrder;
  
  return (
    <>
      {visibleOrder.map(columnId => cells[columnId])}
    </>
  );
}

// Export context for external use if needed
export { ResizableTableContext };

// Legacy exports for compatibility (SortableTableHead now just uses ResizableTableHead)
export const SortableTableHead = ResizableTableHead;
export const DraggableColumnWrapper = ({ children }: { children: React.ReactNode }) => <>{children}</>;
